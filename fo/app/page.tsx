'use client'

import { useState, useEffect, useRef } from 'react'
import mqtt, { MqttClient } from 'mqtt'
import { useRouter } from 'next/navigation'

interface SensorData {
  water_level: number | null
  temperature: number | null
  humidity: number | null
  air_quality: number | null
  voltage: number | null
  current: number | null
  power: number | null
  energy: number | null
  power_factor: number | null
  frequency: number | null
  timestamp: string | null
}

interface RelayState {
  [key: number]: boolean
}

export default function Home() {
  const router = useRouter()
  // State untuk tema
  const [darkMode, setDarkMode] = useState(false)

  // Access Control State
  const [isRestricted, setIsRestricted] = useState(false)
  const [isControlsUnlocked, setIsControlsUnlocked] = useState(false)
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false)
  const [unlockPinInput, setUnlockPinInput] = useState('')
  const [unlockError, setUnlockError] = useState('')

  // State untuk status MQTT
  const [mqttStatus, setMqttStatus] = useState('Menghubungkan...')
  const [lastUpdate, setLastUpdate] = useState('--:--:--')

  // State untuk data sensor
  const [sensorData, setSensorData] = useState<SensorData>({
    water_level: null,
    temperature: null,
    humidity: null,
    air_quality: null,
    voltage: null,
    current: null,
    power: null,
    energy: null,
    power_factor: null,
    frequency: null,
    timestamp: null
  })

  // State untuk relay
  const [relayStates, setRelayStates] = useState<RelayState>({
    1: false,
    2: false
  })

  const [kurasState, setKurasState] = useState(false)
  const [isKurasModalOpen, setIsKurasModalOpen] = useState(false)
  // State untuk fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Ref untuk MQTT client
  const mqttClientRef = useRef<MqttClient | null>(null)

  // Konfigurasi broker MQTT
  const primaryBroker = process.env.NEXT_PUBLIC_BROKER_URL || 'ws://192.168.0.101:9001'
  const fallbackBroker = process.env.NEXT_PUBLIC_BROKER2_URL || 'wss://ws-awg03.qbyte.web.id'
  const truePin = process.env.NEXT_PUBLIC_INFO_PIN || '123456'

  // Hostname Check
  useEffect(() => {
    const hostname = window.location.hostname
    const localDomains = ['localhost', '127.0.0.1', '192.168.0.100']

    if (localDomains.includes(hostname)) {
      setIsRestricted(false)
      setIsControlsUnlocked(true) // Auto unlock on local
    } else {
      setIsRestricted(true)
      setIsControlsUnlocked(false)
    }
  }, [])

  // Efek untuk inisialisasi tema dari localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('color-theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  // Efek untuk koneksi MQTT
  useEffect(() => {
    // Tunggu penentuan hostname simple (sebenarnya sync, tapi aman dalam useEffect)
    const hostname = window.location.hostname
    const localDomains = ['localhost', '127.0.0.1', '192.168.0.100']
    const isLocal = localDomains.includes(hostname)

    if (isLocal) {
      // Logic asli: Coba Primary, fallback ke Secondary
      connectToMQTT(primaryBroker, false)
    } else {
      // Domain logic: Langsung ke Secondary
      connectToMQTT(fallbackBroker, true, true) // Force secondary only logic
    }

    // Cleanup function
    return () => {
      if (mqttClientRef.current) {
        mqttClientRef.current.end()
      }
    }
  }, [])

  // Fungsi untuk menghubungkan ke broker MQTT
  const connectToMQTT = (brokerUrl: string, isFallback = false, forceSingle = false) => {
    const client = mqtt.connect(brokerUrl)

    client.on('connect', () => {
      console.log(`Connected to MQTT Broker: ${brokerUrl}`)
      if (forceSingle) {
        setMqttStatus('Terhubung ke Server Cloud')
      } else {
        setMqttStatus(`Terhubung ke ${isFallback ? 'cadangan ' : ''}broker`)
      }

      // Subscribe ke semua topic
      client.subscribe([
        'sensor/water',
        'sensor/temp',
        'sensor/humidity',
        'sensor/air',
        'kuras/status',
        'relay/1/status',
        'relay/2/status',
        'pzem004t/voltage',
        'pzem004t/current',
        'pzem004t/power',
        'pzem004t/energy',
        'pzem004t/pf',
        'pzem004t/frequency'
      ])
    })

    client.on('error', (err) => {
      console.error(`Connection error (${brokerUrl}):`, err)
      if (!forceSingle && !isFallback) {
        setMqttStatus('Mencoba broker cadangan...')
        setTimeout(() => connectToMQTT(fallbackBroker, true), 2000)
      } else {
        setMqttStatus('Gagal terhubung ke server')
      }
    })

    client.on('message', (topic, message) => {
      const data = message.toString()
      const num = parseFloat(data)

      // Update waktu terakhir
      setLastUpdate(new Date().toLocaleTimeString())

      // Update data sensor berdasarkan topic
      switch (topic) {
        case 'sensor/water':
          setSensorData(prev => ({ ...prev, water_level: num }))
          break
        case 'sensor/temp':
          setSensorData(prev => ({ ...prev, temperature: num }))
          break
        case 'sensor/humidity':
          setSensorData(prev => ({ ...prev, humidity: num }))
          break
        case 'sensor/air':
          setSensorData(prev => ({ ...prev, air_quality: num }))
          break
        case 'relay/1/status':
          setRelayStates(prev => ({ ...prev, 1: data === 'ON' }))
          break
        case 'relay/2/status':
          setRelayStates(prev => ({ ...prev, 2: data === 'ON' }))
          break
        case 'pzem004t/voltage':
          setSensorData(prev => ({ ...prev, voltage: num }))
          break
        case 'pzem004t/current':
          setSensorData(prev => ({ ...prev, current: num }))
          break
        case 'pzem004t/power':
          setSensorData(prev => ({ ...prev, power: num }))
          break
        case 'pzem004t/energy':
          setSensorData(prev => ({ ...prev, energy: num }))
          break
        case 'pzem004t/pf':
          setSensorData(prev => ({ ...prev, power_factor: num }))
          break
        case 'pzem004t/frequency':
          setSensorData(prev => ({ ...prev, frequency: num }))
          break
        case 'kuras/status':
          setKurasState(data === 'ON')
          break
      }
    })

    mqttClientRef.current = client
  }

  // Fungsi untuk toggle relay
  const toggleRelay = (relayNumber: number) => {
    if (!mqttClientRef.current?.connected) {
      alert('Koneksi MQTT tidak terhubung. Tidak dapat mengontrol relay.')
      return
    }

    const newState = !relayStates[relayNumber]
    const state = newState ? 'ON' : 'OFF'
    const topic = `relay/${relayNumber}/status`

    mqttClientRef.current.publish(topic, state, { retain: true })
    setRelayStates(prev => ({ ...prev, [relayNumber]: newState }))

    // Tampilkan notifikasi
    showNotification(`Relay ${relayNumber} diubah ke ${state}`, state === 'ON' ? 'bg-green-500' : 'bg-red-500')
  }
  const toggleKuras = () => {
    if (!mqttClientRef.current?.connected) {
      alert('MQTT belum terhubung')
      return
    }

    const newState = !kurasState
    const state = newState ? 'ON' : 'OFF'

    mqttClientRef.current.publish('kuras/status', state, { retain: true })
    setKurasState(newState)

    showNotification(
      `Mode Kuras ${state}`,
      newState ? 'bg-orange-500' : 'bg-gray-500'
    )
  }


  // Fungsi untuk toggle tema
  const toggleTheme = () => {
    const newDarkMode = !darkMode
    setDarkMode(newDarkMode)

    if (newDarkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('color-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('color-theme', 'light')
    }
  }

  // Fungsi untuk toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Fungsi untuk menampilkan notifikasi
  const showNotification = (message: string, bgColor: string) => {
    // Implementasi notifikasi bisa ditambahkan di sini
    console.log(message)
  }

  // Fungsi untuk refresh halaman
  const refreshPage = () => {
    window.location.reload()
  }

  // Unlock handlers
  const handleUnlockNumberClick = (num: string) => {
    if (unlockPinInput.length < 6) {
      setUnlockPinInput(prev => prev + num)
      setUnlockError('')
    }
  }

  const handleUnlockClear = () => {
    setUnlockPinInput('')
    setUnlockError('')
  }

  const handleUnlockBackspace = () => {
    setUnlockPinInput(prev => prev.slice(0, -1))
    setUnlockError('')
  }

  const handleUnlockSubmit = () => {
    if (unlockPinInput === truePin) {
      setIsControlsUnlocked(true)
      setIsUnlockModalOpen(false)
      setUnlockPinInput('')
      setUnlockError('')
    } else {
      setUnlockError('PIN Salah!')
      setUnlockPinInput('')
    }
  }

  return (
    <div className="min-h-full flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              {/* Logo Toyaku */}
              <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-white font-bold">T</span>
              </div>
              <h1 className="ml-2 text-2xl font-bold text-gray-900 dark:text-white">Toyaku</h1>
            </div>
            <span className="hidden sm:inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              Generator Air dari Udara
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${mqttStatus.includes('Terhubung')
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : mqttStatus.includes('Mencoba')
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                {mqttStatus}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {lastUpdate}
              </span>
            </div>
            <button
              onClick={refreshPage}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={darkMode
                    ? "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    : "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  }
                />
              </svg>
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isFullscreen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Water Level Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 relative overflow-hidden transition-transform duration-300 hover:scale-105">
              <div className="absolute top-0 right-0 -mr-6 -mt-6 bg-blue-100 dark:bg-blue-900 rounded-full w-24 h-24 opacity-20"></div>
              <div className="relative z-10 flex items-center">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Level Air</h3>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {sensorData.water_level !== null ? `${sensorData.water_level} %` : '-- %'}
                  </p>
                </div>
              </div>
              <div className="relative mt-6 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all duration-1000"
                  style={{ width: `${sensorData.water_level || 0}%` }}
                ></div>
              </div>
            </div>

            {/* Temperature Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 relative overflow-hidden transition-transform duration-300 hover:scale-105">
              <div className="absolute top-0 right-0 -mr-6 -mt-6 bg-red-100 dark:bg-red-900 rounded-full w-24 h-24 opacity-20"></div>
              <div className="relative z-10 flex items-center">
                <div className="p-3 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Suhu</h3>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {sensorData.temperature !== null ? `${sensorData.temperature} °C` : '-- °C'}
                  </p>
                </div>
              </div>
            </div>

            {/* Humidity Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 relative overflow-hidden transition-transform duration-300 hover:scale-105">
              <div className="absolute top-0 right-0 -mr-6 -mt-6 bg-green-100 dark:bg-green-900 rounded-full w-24 h-24 opacity-20"></div>
              <div className="relative z-10 flex items-center">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Kelembaban</h3>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {sensorData.humidity !== null ? `${sensorData.humidity} %` : '-- %'}
                  </p>
                </div>
              </div>
            </div>

            {/* Air Quality Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 relative overflow-hidden transition-transform duration-300 hover:scale-105">
              <div className="absolute top-0 right-0 -mr-6 -mt-6 bg-yellow-100 dark:bg-yellow-900 rounded-full w-24 h-24 opacity-20"></div>
              <div className="relative z-10 flex items-center">
                <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Kualitas Udara</h3>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {sensorData.air_quality !== null ? `${sensorData.air_quality} ug/m3` : '-- ug/m3'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Water Visualization and Controls - Conditional Rendering */}
          {(!isRestricted || isControlsUnlocked) ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Water Tank Visualization */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 col-span-1 lg:col-span-2 transition-transform duration-300 hover:scale-[1.01]">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Status Tangki Air</h2>
                <div className="relative h-64 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                  {/* Water level visualization */}
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-blue-500 transition-all duration-1000"
                    style={{ height: `${sensorData.water_level || 0}%` }}
                  >
                    {/* Water waves effect */}
                    <div className="absolute -bottom-2 left-0 right-0 h-8 overflow-hidden">
                      <div
                        className="absolute -bottom-4 left-0 right-0 h-12 bg-blue-400 opacity-70 wave"
                        style={{
                          backgroundImage: `url('data:image/svg+xml;utf8,<svg viewBox="0 0 100 20" xmlns="http://www.w3.org/2000/svg"><path fill="%230ea5e9" d="M0 10 C 20 20, 40 0, 60 10 C 80 20, 100 0, 100 10 L100 20 L0 20 Z"></path></svg>')`,
                          backgroundSize: '50% 100%'
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Water drops falling animation */}
                  <div className="absolute top-0 left-1/4 w-2 h-2 rounded-full bg-blue-300 opacity-70 water-drop" style={{ animationDelay: '0s' }}></div>
                  <div className="absolute top-0 left-1/2 w-3 h-3 rounded-full bg-blue-400 opacity-80 water-drop" style={{ animationDelay: '0.5s' }}></div>
                  <div className="absolute top-0 left-3/4 w-2 h-2 rounded-full bg-blue-200 opacity-60 water-drop" style={{ animationDelay: '1s' }}></div>

                  {/* Tank markings */}
                  <div className="absolute left-0 right-0 top-1/4 border-t border-gray-300 dark:border-gray-600"></div>
                  <div className="absolute left-0 right-0 top-1/2 border-t border-gray-300 dark:border-gray-600"></div>
                  <div className="absolute left-0 right-0 top-3/4 border-t border-gray-300 dark:border-gray-600"></div>

                  <div className="absolute left-2 top-1/4 text-xs text-gray-500 dark:text-gray-400">75%</div>
                  <div className="absolute left-2 top-1/2 text-xs text-gray-500 dark:text-gray-400">50%</div>
                  <div className="absolute left-2 top-3/4 text-xs text-gray-500 dark:text-gray-400">25%</div>

                  {/* Current level indicator */}
                  <div
                    className="absolute left-0 right-0 flex justify-center items-center"
                    style={{ bottom: `${sensorData.water_level || 0}%` }}
                  >
                    <div className="bg-white dark:bg-gray-800 px-2 py-1 rounded text-xs font-medium text-blue-600 dark:text-blue-400 shadow-sm">
                      {sensorData.water_level !== null ? sensorData.water_level : 0}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-transform duration-300 hover:scale-[1.01]">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Kontrol Perangkat</h2>
                <div className="space-y-4">
                  {/* Condenser Control */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-white">Kondensor</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${relayStates[1]
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}>
                        {relayStates[1] ? 'HIDUP' : 'MATI'}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleRelay(1)}
                      className={`w-full py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center ${relayStates[1]
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'bg-red-500 hover:bg-red-600 text-white'
                        }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                      </svg>
                      {relayStates[1] ? 'Matikan Kondensor' : 'Nyalakan Kondensor'}
                    </button>
                  </div>

                  {/* Pump Control */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-white">Pompa Air</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${relayStates[2]
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}>
                        {relayStates[2] ? 'HIDUP' : 'MATI'}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleRelay(2)}
                      className={`w-full py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center ${relayStates[2]
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'bg-red-500 hover:bg-red-600 text-white'
                        }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {relayStates[2] ? 'Matikan Pompa' : 'Nyalakan Pompa'}
                    </button>
                  </div>

                  {/* Kuras Control */}
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-800/50">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-white">Mode Kuras</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${kurasState
                        ? 'bg-orange-200 dark:bg-orange-800 text-orange-900 dark:text-orange-200'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}>
                        {kurasState ? 'AKTIF' : 'NONAKTIF'}
                      </span>
                    </div>
                    <button
                      onClick={() => setIsKurasModalOpen(true)}
                      className={`w-full py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center text-sm ${kurasState
                        ? 'bg-orange-600 hover:bg-orange-700 text-white'
                        : 'bg-gray-400 hover:bg-gray-500 text-white'
                        }`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 3v18h18M7 14l4-4 4 4m0-8l-4 4-4-4"
                        />
                      </svg>
                      {kurasState ? 'Hentikan Kuras' : 'Mulai Kuras'}
                    </button>
                    <p className="mt-2 text-xs text-orange-700 dark:text-orange-300">
                      Otomatis berhenti saat penuh.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-12">
              <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg max-w-lg w-full text-center border-l-4 border-blue-500">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Kontrol Terkunci</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Akses kontrol perangkat dibatasi untuk koneksi publik. Silakan masukkan PIN untuk membuka akses kontrol.
                </p>
                <button
                  onClick={() => setIsUnlockModalOpen(true)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-md w-full"
                >
                  Buka Kontrol Perangkat
                </button>
              </div>
            </div>
          )}


          {/* Action Buttons */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
              <button onClick={() => router.push('/info')} className="inline-flex items-center px-4 py-3 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors duration-300 shadow-md hover:shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                info
              </button>

              <button className="inline-flex items-center px-4 py-3 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-300 shadow-md hover:shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Tentang Toyaku
              </button>

              <button className="inline-flex items-center px-4 py-3 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-300 shadow-md hover:shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Cara Kerja Toyaku
              </button>

              <button onClick={() => router.push('/daya')} className="inline-flex items-center px-4 py-3 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors duration-300 shadow-md hover:shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                </svg>
                Daya
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              &copy; 2025 Toyaku Generator Air Atmosfer. Semua hak dilindungi.
            </p>
            <div className="mt-4 md:mt-0 flex space-x-6">
              <button className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
              <button className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Modal Konfirmasi Kuras */}
      {isKurasModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-auto transform transition-all scale-100">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Konfirmasi Mode Kuras
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Apakah Anda yakin ingin {kurasState ? 'menghentikan' : 'memulai'} proses kuras tangki?
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setIsKurasModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  toggleKuras()
                  setIsKurasModalOpen(false)
                }}
                className={`px-4 py-2 rounded-lg text-white transition-colors font-medium ${kurasState
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-orange-500 hover:bg-orange-600'
                  }`}
              >
                Ya, {kurasState ? 'Hentikan' : 'Mulai'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Unlock Control */}
      {isUnlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-xs w-full overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-white">Masukkan PIN</h3>
              <button
                onClick={() => setIsUnlockModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <div className={`h-12 bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center text-2xl tracking-widest font-mono border-2 ${unlockError ? 'border-red-500 text-red-500' : 'border-transparent text-gray-900 dark:text-white'}`}>
                  {unlockPinInput.split('').map(() => '•').join('') || (
                    <span className="text-gray-400 text-sm font-sans tracking-normal opacity-50">Masukkan PIN</span>
                  )}
                </div>
                {unlockError && <p className="text-red-500 text-xs text-center mt-2 font-medium">{unlockError}</p>}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleUnlockNumberClick(num.toString())}
                    className="h-12 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold text-lg hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-blue-100 dark:active:bg-blue-900 transition-colors"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={handleUnlockClear}
                  className="h-12 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium text-xs uppercase hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center"
                >
                  Clear
                </button>
                <button
                  onClick={() => handleUnlockNumberClick('0')}
                  className="h-12 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold text-lg hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-blue-100 dark:active:bg-blue-900 transition-colors"
                >
                  0
                </button>
                <button
                  onClick={handleUnlockBackspace}
                  className="h-12 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                  </svg>
                </button>
              </div>

              <button
                onClick={handleUnlockSubmit}
                className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-md transition-all active:scale-[0.98]"
              >
                Buka
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS Styles */}
      <style jsx global>{`
        .water-drop {
          animation: dropFall 3s ease-in-out infinite;
        }
        
        @keyframes dropFall {
          0% { transform: translateY(-20px); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(20px); opacity: 0; }
        }
        
        .wave {
          animation: wave 8s linear infinite;
        }
        
        @keyframes wave {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}