'use client'

import React, { useState, useEffect, useRef } from 'react'
import mqtt, { MqttClient } from 'mqtt'
import { useRouter } from 'next/navigation'

interface AWGData {
  water_atas: number | null
  water_bawah: number | null
  suhu_eva: number | null
  kipas_speed: number | null
  kompresor: boolean
  blower: boolean
  pompa_bawah: boolean
  pompa_out: boolean
  mode: string
  kuras: boolean
  auto_restart: boolean
  // Sensor Lingkungan dari Wemos Tombol (DHT11 & MQ-2)
  temp_lingkungan: number | null
  hum_lingkungan: number | null
  gas_mq2: number | null
}

interface MqttLog {
  id: string
  topic: string
  payload: string
  timestamp: string
}

export default function DataLainnyaPage() {
  const router = useRouter()

  // Theme State
  const [darkMode, setDarkMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Access Control State
  const [isRestricted, setIsRestricted] = useState(false)
  const [isControlsUnlocked, setIsControlsUnlocked] = useState(false)
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false)
  const [unlockPinInput, setUnlockPinInput] = useState('')
  const [unlockError, setUnlockError] = useState('')

  // Modal State
  const [isKurasModalOpen, setIsKurasModalOpen] = useState(false)

  // Connection State
  const [mqttStatus, setMqttStatus] = useState('Menghubungkan...')
  const [lastUpdate, setLastUpdate] = useState('--:--:--')
  const [activeBroker, setActiveBroker] = useState('')

  // AWG Telemetry Data
  const [data, setData] = useState<AWGData>({
    water_atas: null,
    water_bawah: null,
    suhu_eva: null,
    kipas_speed: null,
    kompresor: false,
    blower: false,
    pompa_bawah: false,
    pompa_out: false,
    mode: 'IDLE',
    kuras: false,
    auto_restart: true,
    temp_lingkungan: null,
    hum_lingkungan: null,
    gas_mq2: null
  })

  // Manual Fan Slider State
  const [sliderKipas, setSliderKipas] = useState<number>(0)

  // Live MQTT Logs
  const [logs, setLogs] = useState<MqttLog[]>([])

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; color: string } | null>(null)

  // MQTT Ref
  const clientRef = useRef<MqttClient | null>(null)

  // Broker Configurations
  const primaryBroker = process.env.NEXT_PUBLIC_BROKER_URL || 'ws://192.168.0.101:9001'
  const fallbackBroker = process.env.NEXT_PUBLIC_BROKER2_URL || 'wss://ws-awg03.qbyte.web.id'
  const truePin = process.env.NEXT_PUBLIC_INFO_PIN || '123456'

  const showToast = (text: string, color = 'bg-blue-600') => {
    setToastMessage({ text, color })
    setTimeout(() => setToastMessage(null), 3000)
  }

  // Check Hostname / Network
  useEffect(() => {
    const hostname = window.location.hostname
    const isLocal =
      ['localhost', '127.0.0.1', '192.168.0.100'].includes(hostname) ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.') ||
      hostname.endsWith('.local')

    if (isLocal) {
      setIsRestricted(false)
      setIsControlsUnlocked(true)
    } else {
      setIsRestricted(true)
      setIsControlsUnlocked(false)
    }
  }, [])

  // Sync Theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('color-theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Connect to MQTT
  const connectToMQTT = (brokerUrl: string, isFallback = false, forceSingle = false) => {
    setActiveBroker(brokerUrl)
    setMqttStatus('Menghubungkan...')

    const client = mqtt.connect(brokerUrl, {
      clientId: `Toyaku_DataLainnya_${Math.random().toString(16).slice(2, 8)}`,
      connectTimeout: 5000,
      reconnectPeriod: 3000
    })

    client.on('connect', () => {
      console.log(`[DataLainnya] Connected to MQTT Broker: ${brokerUrl}`)
      if (forceSingle) {
        setMqttStatus('Terhubung ke Server Cloud')
      } else {
        setMqttStatus(`Terhubung ke ${isFallback ? 'broker cadangan' : 'broker utama'}`)
      }

      // Subscribe to all AWG topics from main.ino & sensor lingkungan Wemos
      client.subscribe([
        'awg/sensor/water_atas',
        'awg/sensor/water_bawah',
        'awg/sensor/suhu_eva',
        'awg/sensor/temp',
        'awg/sensor/humidity',
        'awg/sensor/air',
        'sensor/temp',
        'sensor/humidity',
        'sensor/air',
        'awg/status/kipas',
        'awg/status/kompresor',
        'awg/status/blower',
        'awg/status/pompa_bawah',
        'awg/status/pompa_out',
        'awg/status/mode',
        'awg/status/kuras',
        'awg/status/auto_restart'
      ])
    })

    client.on('error', (err) => {
      console.error(`[DataLainnya] Connection error (${brokerUrl}):`, err)
      if (!forceSingle && !isFallback) {
        setMqttStatus('Mencoba broker cadangan...')
        setTimeout(() => connectToMQTT(fallbackBroker, true), 2000)
      } else {
        setMqttStatus('Gagal terhubung ke broker')
      }
    })

    client.on('message', (topic, message) => {
      const payloadStr = message.toString()
      const timeStr = new Date().toLocaleTimeString('id-ID')
      setLastUpdate(timeStr)

      // Add to log (max 30 items)
      setLogs(prev => [
        {
          id: Math.random().toString(36).substring(2, 9),
          topic,
          payload: payloadStr,
          timestamp: timeStr
        },
        ...prev.slice(0, 29)
      ])

      const num = parseFloat(payloadStr)

      switch (topic) {
        case 'awg/sensor/water_atas':
          setData(prev => ({ ...prev, water_atas: isNaN(num) ? null : num }))
          break
        case 'awg/sensor/water_bawah':
          setData(prev => ({ ...prev, water_bawah: isNaN(num) ? null : num }))
          break
        case 'awg/sensor/suhu_eva':
          setData(prev => ({ ...prev, suhu_eva: isNaN(num) ? null : num }))
          break
        case 'awg/sensor/temp':
        case 'sensor/temp':
          setData(prev => ({ ...prev, temp_lingkungan: isNaN(num) ? null : num }))
          break
        case 'awg/sensor/humidity':
        case 'sensor/humidity':
          setData(prev => ({ ...prev, hum_lingkungan: isNaN(num) ? null : num }))
          break
        case 'awg/sensor/air':
        case 'sensor/air':
          setData(prev => ({ ...prev, gas_mq2: isNaN(num) ? null : num }))
          break
        case 'awg/status/kipas':
          setData(prev => ({ ...prev, kipas_speed: isNaN(num) ? null : num }))
          if (!isNaN(num)) setSliderKipas(num)
          break
        case 'awg/status/kompresor':
          setData(prev => ({ ...prev, kompresor: payloadStr === 'ON' }))
          break
        case 'awg/status/blower':
          setData(prev => ({ ...prev, blower: payloadStr === 'ON' }))
          break
        case 'awg/status/pompa_bawah':
          setData(prev => ({ ...prev, pompa_bawah: payloadStr === 'ON' }))
          break
        case 'awg/status/pompa_out':
          setData(prev => ({ ...prev, pompa_out: payloadStr === 'ON' }))
          break
        case 'awg/status/mode':
          setData(prev => ({ ...prev, mode: payloadStr }))
          break
        case 'awg/status/kuras':
          setData(prev => ({ ...prev, kuras: payloadStr === 'ON' }))
          break
        case 'awg/status/auto_restart':
          setData(prev => ({ ...prev, auto_restart: payloadStr === 'ON' }))
          break
      }
    })

    clientRef.current = client
  }

  // Connect to MQTT Effect
  useEffect(() => {
    const hostname = window.location.hostname
    const isLocal =
      ['localhost', '127.0.0.1', '192.168.0.100'].includes(hostname) ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.') ||
      hostname.endsWith('.local')

    if (isLocal) {
      connectToMQTT(primaryBroker, false)
    } else {
      connectToMQTT(fallbackBroker, true, true)
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.end()
      }
    }
  }, [])

  // MQTT Command Sender
  const sendCommand = (topic: string, message: string, label: string) => {
    if (!clientRef.current?.connected) {
      showToast('Koneksi MQTT terputus. Gagal mengirim perintah.', 'bg-red-600')
      return
    }

    clientRef.current.publish(topic, message, { retain: false })
    showToast(`Perintah dikirim: ${label} -> ${message}`, 'bg-emerald-600')
  }

  // Toggle Kompresor
  const handleToggleKompresor = () => {
    const nextState = !data.kompresor
    const cmd = nextState ? 'ON' : 'OFF'
    sendCommand('awg/cmd/kompresor', cmd, 'Kompresor')
  }

  // Toggle Pompa Out
  const handleTogglePompaOut = () => {
    const nextState = !data.pompa_out
    const cmd = nextState ? 'ON' : 'OFF'
    sendCommand('awg/cmd/pompa_out', cmd, 'Pompa Out')
  }

  // Toggle Auto-Restart
  const handleToggleAutoRestart = () => {
    const nextState = !data.auto_restart
    const cmd = nextState ? 'ON' : 'OFF'
    sendCommand('awg/cmd/auto_restart', cmd, 'Auto-Restart')
  }

  // Toggle Mode Kuras
  const handleConfirmKuras = () => {
    const nextState = !data.kuras
    const cmd = nextState ? 'ON' : 'OFF'
    sendCommand('awg/cmd/kuras', cmd, 'Mode Kuras')
    setIsKurasModalOpen(false)
  }

  // Slider Kipas
  const handleKipasChange = (val: number) => {
    setSliderKipas(val)
    sendCommand('awg/cmd/kipas', val.toString(), `Kipas ${val}%`)
  }

  // Unlock PIN handlers
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
      showToast('Kontrol berhasil dibuka!', 'bg-green-600')
    } else {
      setUnlockError('PIN Salah!')
      setUnlockPinInput('')
    }
  }

  // Helper level badge
  const getLevelBadge = (level: number | null) => {
    if (level === null) return { text: 'Tidak ada data', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' }
    if (level >= 100) return { text: 'Penuh (100%)', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-200' }
    if (level >= 70) return { text: 'Tinggi (~70%)', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200' }
    if (level >= 30) return { text: 'Sedang (~30%)', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200' }
    return { text: 'Kosong (0%)', color: 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200' }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center shadow-lg rounded-lg px-4 py-2.5 text-white text-xs font-medium transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${toastMessage.color}">
          <span className="mr-2">ℹ️</span>
          {toastMessage.text}
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 backdrop-blur-md bg-opacity-90 dark:bg-opacity-90">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push('/')}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Kembali ke Dashboard Utama"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Data Lainnya & Telemetri AWG</h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                  ESP32 Master
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Atmospheric Water Generator — FreeRTOS Dual-Core</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center ${mqttStatus.includes('Terhubung')
                ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                : mqttStatus.includes('Mencoba')
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                }`}>
                <span className={`w-2 h-2 rounded-full mr-1.5 ${mqttStatus.includes('Terhubung') ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                {mqttStatus}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono hidden md:inline">
                {lastUpdate}
              </span>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
              title="Refresh"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
              title="Ganti Tema"
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
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hidden sm:block"
              title="Fullscreen"
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

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-5">
        {/* Banner Status Mode & Auto-Restart */}
        <div className="bg-gradient-to-r from-blue-900/80 via-indigo-900/80 to-purple-900/80 rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-indigo-500/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <span className="text-2xl">⚡</span>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-indigo-200 font-semibold">Mode Operasional Saat Ini</div>
              <div className="flex items-center space-x-3 mt-1">
                <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase shadow-sm ${data.mode === 'PRODUKSI'
                  ? 'bg-emerald-500 text-white animate-pulse'
                  : data.mode === 'KURAS'
                    ? 'bg-amber-500 text-white animate-pulse'
                    : 'bg-gray-600 text-gray-100'
                  }`}>
                  ● {data.mode || 'IDLE'}
                </span>
                <span className="text-xs text-indigo-200">
                  {data.mode === 'PRODUKSI' && 'Kompresor & Blower aktif mendinginkan evaporator untuk kondensasi'}
                  {data.mode === 'KURAS' && 'Pompa transfer aktif memindahkan air tangki bawah ke tangki atas'}
                  {data.mode === 'IDLE' && 'Sistem standby, menunggu perintah atau auto-restart'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4 bg-black/20 px-3.5 py-2 rounded-xl backdrop-blur-sm self-stretch md:self-auto justify-between">
            <div>
              <div className="text-[11px] text-indigo-200 font-medium">Auto-Restart Produksi</div>
              <div className="text-xs font-semibold text-white">
                {data.auto_restart ? 'Aktif (Level ≤ 30%)' : 'Dinonaktifkan'}
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${data.auto_restart ? 'bg-emerald-500/80 text-white' : 'bg-gray-600 text-gray-300'}`}>
              {data.auto_restart ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>

        {/* Section 1: SENSOR ANALOG & LEVEL AIR */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center">
              <span className="w-2 h-4 bg-blue-500 rounded mr-2 inline-block"></span>
              Data Sensor & Tangki Air
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">MQTT: awg/sensor/*</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Suhu Evaporator */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 transition hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                    Suhu Evaporator
                  </span>
                  <div className="mt-2 flex items-baseline space-x-2">
                    <span className="text-3xl font-extrabold text-gray-900 dark:text-white font-mono">
                      {data.suhu_eva !== null ? data.suhu_eva : '--'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">raw ADC</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
              </div>

              {/* Progress representation */}
              <div className="mt-3">
                <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(0, ((data.suhu_eva || 0) / 4095) * 100))}%` }}
                  ></div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex justify-between items-center text-xs">
                <span className="text-gray-500 dark:text-gray-400">Pin Hardware:</span>
                <span className="font-mono font-medium text-gray-700 dark:text-gray-300">GPIO 34 (ADC1_CH6)</span>
              </div>
              <div className="mt-1 flex justify-between items-center text-[11px] text-gray-500 dark:text-gray-400">
                <span>Topik MQTT:</span>
                <span className="font-mono text-blue-600 dark:text-blue-400">awg/sensor/suhu_eva</span>
              </div>
            </div>

            {/* 2. Tangki Atas */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 transition hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                    Tangki Air Atas (Hasil)
                  </span>
                  <div className="mt-2 flex items-baseline space-x-2">
                    <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                      {data.water_atas !== null ? `${data.water_atas}%` : '--%'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${getLevelBadge(data.water_atas).color}`}>
                      {getLevelBadge(data.water_atas).text}
                    </span>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>

              {/* Tank Fill Bar */}
              <div className="mt-3">
                <div className="h-3 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full transition-all duration-700"
                    style={{ width: `${data.water_atas || 0}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-mono">
                  <span>0%</span>
                  <span>30%</span>
                  <span>70%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex justify-between items-center text-xs">
                <span className="text-gray-500 dark:text-gray-400">Pin Hardware:</span>
                <span className="font-mono font-medium text-gray-700 dark:text-gray-300">GPIO 32 (ADC1_CH4)</span>
              </div>
              <div className="mt-1 flex justify-between items-center text-[11px] text-gray-500 dark:text-gray-400">
                <span>Topik MQTT:</span>
                <span className="font-mono text-cyan-600 dark:text-cyan-400">awg/sensor/water_atas</span>
              </div>
            </div>

            {/* 3. Tangki Bawah */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 transition hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                    Tangki Air Bawah (Tampung)
                  </span>
                  <div className="mt-2 flex items-baseline space-x-2">
                    <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                      {data.water_bawah !== null ? `${data.water_bawah}%` : '--%'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${getLevelBadge(data.water_bawah).color}`}>
                      {getLevelBadge(data.water_bawah).text}
                    </span>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>

              {/* Tank Fill Bar */}
              <div className="mt-3">
                <div className="h-3 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full transition-all duration-700"
                    style={{ width: `${data.water_bawah || 0}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-mono">
                  <span>0%</span>
                  <span>30%</span>
                  <span>70%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex justify-between items-center text-xs">
                <span className="text-gray-500 dark:text-gray-400">Pin Hardware:</span>
                <span className="font-mono font-medium text-gray-700 dark:text-gray-300">GPIO 33 (ADC1_CH5)</span>
              </div>
              <div className="mt-1 flex justify-between items-center text-[11px] text-gray-500 dark:text-gray-400">
                <span>Topik MQTT:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">awg/sensor/water_bawah</span>
              </div>
            </div>
          </div>

          {/* Sensor Lingkungan (DHT11 & MQ-2 dari Wemos Tombol) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
            {/* Suhu Lingkungan */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3.5 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Suhu Udara Sekitar</span>
                <div className="text-xl font-extrabold text-red-500 dark:text-red-400 mt-1">
                  {data.temp_lingkungan !== null ? `${data.temp_lingkungan} °C` : '-- °C'}
                </div>
                <div className="text-[10px] text-gray-400 font-mono">DHT11 • awg/sensor/temp</div>
              </div>
              <div className="p-2.5 bg-red-50 dark:bg-red-900/30 text-red-500 rounded-xl text-xl">🌡️</div>
            </div>

            {/* Kelembaban Lingkungan */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3.5 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Kelembaban Udara</span>
                <div className="text-xl font-extrabold text-teal-500 dark:text-teal-400 mt-1">
                  {data.hum_lingkungan !== null ? `${data.hum_lingkungan} %` : '-- %'}
                </div>
                <div className="text-[10px] text-gray-400 font-mono">DHT11 • awg/sensor/humidity</div>
              </div>
              <div className="p-2.5 bg-teal-50 dark:bg-teal-900/30 text-teal-500 rounded-xl text-xl">💧</div>
            </div>

            {/* Gas MQ-2 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3.5 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Kualitas Udara (Gas)</span>
                <div className="text-xl font-extrabold text-amber-500 dark:text-amber-400 mt-1">
                  {data.gas_mq2 !== null ? `${data.gas_mq2} ADC` : '-- ADC'}
                </div>
                <div className="text-[10px] text-gray-400 font-mono">MQ-02 • awg/sensor/air</div>
              </div>
              <div className="p-2.5 bg-amber-50 dark:bg-amber-900/30 text-amber-500 rounded-xl text-xl">💨</div>
            </div>
          </div>
        </div>

        {/* Section 2: STATUS AKTUATOR & RELAY */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center">
              <span className="w-2 h-4 bg-purple-500 rounded mr-2 inline-block"></span>
              Status Aktuator & Relay (Aktual)
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">MQTT: awg/status/*</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* Kompresor */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3.5 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Kompresor</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${data.kompresor
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200'
                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                  {data.kompresor ? 'HIDUP' : 'MATI'}
                </span>
              </div>
              <div className="mt-2 text-xl font-bold flex items-center text-gray-900 dark:text-white">
                <span className="mr-2">❄️</span>
                {data.kompresor ? 'Aktif' : 'Nonaktif'}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Relay 2 — GPIO 14
              </div>
            </div>

            {/* Blower */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3.5 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Blower</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${data.blower
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200'
                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                  {data.blower ? 'HIDUP' : 'MATI'}
                </span>
              </div>
              <div className="mt-2 text-xl font-bold flex items-center text-gray-900 dark:text-white">
                <span className="mr-2">💨</span>
                {data.blower ? 'Aktif' : 'Nonaktif'}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Relay 4 — GPIO 27 (Otomatis)
              </div>
            </div>

            {/* Pompa Bawah */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3.5 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Pompa Bawah</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${data.pompa_bawah
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200'
                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                  {data.pompa_bawah ? 'HIDUP' : 'MATI'}
                </span>
              </div>
              <div className="mt-2 text-xl font-bold flex items-center text-gray-900 dark:text-white">
                <span className="mr-2">⬆️</span>
                {data.pompa_bawah ? 'Memompa' : 'Standby'}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Relay 1 — GPIO 13 (Otomatis)
              </div>
            </div>

            {/* Pompa Keluar (Out) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3.5 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Pompa Out</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${data.pompa_out
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200'
                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                  {data.pompa_out ? 'HIDUP' : 'MATI'}
                </span>
              </div>
              <div className="mt-2 text-xl font-bold flex items-center text-gray-900 dark:text-white">
                <span className="mr-2">🚰</span>
                {data.pompa_out ? 'Mengalir' : 'Mati'}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Relay 3 — GPIO 12 (Kran Minum)
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: KONTROL PERANGKAT & AKTUATOR */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center">
              <span className="w-2 h-4 bg-emerald-500 rounded mr-2 inline-block"></span>
              Kontrol Aktuator & Perintah (Commands)
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">MQTT: awg/cmd/*</span>
          </div>

          {(!isRestricted || isControlsUnlocked) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Kontrol Kompresor / Produksi */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white flex items-center">
                      <span className="mr-2">❄️</span> Produksi (Kompresor)
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${data.kompresor ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200' : 'bg-gray-200 dark:bg-gray-700'}`}>
                      {data.kompresor ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Nyalakan siklus kondensasi (Kompresor R2 + Blower R4 + Kipas PWM 100%).
                  </p>
                </div>
                <button
                  onClick={handleToggleKompresor}
                  className={`w-full py-2.5 px-3 rounded-lg font-medium text-xs transition-all shadow-sm flex items-center justify-center ${data.kompresor
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                >
                  {data.kompresor ? 'Hentikan Produksi' : 'Mulai Produksi'}
                </button>
              </div>

              {/* 2. Kontrol Pompa Keluar (Out) */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white flex items-center">
                      <span className="mr-2">🚰</span> Pompa Out (Kran Air)
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${data.pompa_out ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200' : 'bg-gray-200 dark:bg-gray-700'}`}>
                      {data.pompa_out ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Keluarkan air minum yang telah tersaring dari tangki atas (Relay R3).
                  </p>
                </div>
                <button
                  onClick={handleTogglePompaOut}
                  className={`w-full py-2.5 px-3 rounded-lg font-medium text-xs transition-all shadow-sm flex items-center justify-center ${data.pompa_out
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                >
                  {data.pompa_out ? 'Tutup Kran Air' : 'Buka Kran Air'}
                </button>
              </div>

              {/* 3. Kontrol Mode Kuras */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-amber-200 dark:border-amber-900/40 flex flex-col justify-between bg-amber-50/30 dark:bg-amber-950/10">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white flex items-center">
                      <span className="mr-2">🔄</span> Mode Kuras
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${data.kuras ? 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100' : 'bg-gray-200 dark:bg-gray-700'}`}>
                      {data.kuras ? 'AKTIF' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
                    Pindahkan semua air tangki bawah ke tangki atas hingga penuh.
                  </p>
                </div>
                <button
                  onClick={() => setIsKurasModalOpen(true)}
                  className={`w-full py-2.5 px-3 rounded-lg font-medium text-xs transition-all shadow-sm flex items-center justify-center ${data.kuras
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                    }`}
                >
                  {data.kuras ? 'Batalkan Kuras' : 'Mulai Mode Kuras'}
                </button>
              </div>

              {/* 4. Kontrol Auto-Restart */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white flex items-center">
                      <span className="mr-2">🔁</span> Auto-Restart
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${data.auto_restart ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200' : 'bg-gray-200 dark:bg-gray-700'}`}>
                      {data.auto_restart ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Nyalakan kembali produksi saat tangki atas berkurang hingga level ≤ 30%.
                  </p>
                </div>
                <button
                  onClick={handleToggleAutoRestart}
                  className={`w-full py-2.5 px-3 rounded-lg font-medium text-xs transition-all shadow-sm flex items-center justify-center ${data.auto_restart
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-gray-500 hover:bg-gray-600 text-white'
                    }`}
                >
                  {data.auto_restart ? 'Matikan Auto-Restart' : 'Aktifkan Auto-Restart'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm text-center border-l-4 border-indigo-500 max-w-xl mx-auto">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center mx-auto mb-2 text-indigo-600 dark:text-indigo-400">
                🔒
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">Kontrol Aktuator Terkunci</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
                Untuk keamanan jaringan publik, masukkan PIN untuk mengoperasikan aktuator.
              </p>
              <button
                onClick={() => setIsUnlockModalOpen(true)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow"
              >
                Buka Kunci Kontrol
              </button>
            </div>
          )}

          {/* Section Kipas PWM Slider (Manual) */}
          <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                  <span className="mr-2">🌀</span> Kipas Sirkulasi PWM (GPIO 2 — 25 kHz)
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Kecepatan aktual: <strong className="text-gray-800 dark:text-gray-200">{data.kipas_speed !== null ? `${data.kipas_speed}%` : '--%'}</strong> |
                  Topik kirim: <code className="font-mono text-indigo-600 dark:text-indigo-400">awg/cmd/kipas</code>
                </p>
              </div>
              <div className="flex items-center space-x-1.5">
                {[0, 25, 50, 75, 100].map(val => (
                  <button
                    key={val}
                    onClick={() => handleKipasChange(val)}
                    disabled={isRestricted && !isControlsUnlocked}
                    className="px-2.5 py-1 text-xs font-mono font-medium rounded bg-gray-100 dark:bg-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-gray-800 dark:text-gray-200 disabled:opacity-50"
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="0"
                max="100"
                value={sliderKipas}
                disabled={isRestricted && !isControlsUnlocked}
                onChange={(e) => setSliderKipas(parseInt(e.target.value))}
                onMouseUp={() => handleKipasChange(sliderKipas)}
                onTouchEnd={() => handleKipasChange(sliderKipas)}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <span className="text-sm font-mono font-bold w-12 text-right text-indigo-600 dark:text-indigo-400">
                {sliderKipas}%
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: LIVE TELEMETRI MQTT LOG & HARDWARE INFO */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Hardware Pinout & RTOS Architecture Reference */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3 flex items-center">
              <span className="w-2 h-3 bg-indigo-500 rounded mr-1.5 inline-block"></span>
              Pemetaan Hardware ESP32
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/50">
                <span className="text-gray-500 dark:text-gray-400">Relay 1 (Pompa Bawah):</span>
                <span className="font-mono font-semibold">GPIO 13 (Aktif HIGH)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/50">
                <span className="text-gray-500 dark:text-gray-400">Relay 2 (Kompresor):</span>
                <span className="font-mono font-semibold">GPIO 14 (Aktif HIGH)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/50">
                <span className="text-gray-500 dark:text-gray-400">Relay 3 (Pompa Out):</span>
                <span className="font-mono font-semibold">GPIO 12 (Aktif HIGH)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/50">
                <span className="text-gray-500 dark:text-gray-400">Relay 4 (Blower):</span>
                <span className="font-mono font-semibold">GPIO 27 (Aktif HIGH)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/50">
                <span className="text-gray-500 dark:text-gray-400">Kipas PWM:</span>
                <span className="font-mono font-semibold">GPIO 2 (25 kHz 8-bit)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/50">
                <span className="text-gray-500 dark:text-gray-400">Sensor Water Atas:</span>
                <span className="font-mono font-semibold">GPIO 32 (ADC1_CH4)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700/50">
                <span className="text-gray-500 dark:text-gray-400">Sensor Water Bawah:</span>
                <span className="font-mono font-semibold">GPIO 33 (ADC1_CH5)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500 dark:text-gray-400">Sensor Suhu Eva:</span>
                <span className="font-mono font-semibold">GPIO 34 (ADC1_CH6)</span>
              </div>
            </div>

            <div className="mt-4 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 text-[11px] text-gray-600 dark:text-gray-400">
              <strong className="text-gray-900 dark:text-gray-200">Arsitektur FreeRTOS Dual-Core:</strong>
              <ul className="list-disc ml-4 mt-1 space-y-0.5">
                <li>Core 1 (Prio 2): Task Sensor ADC & Logika Kontrol Relay</li>
                <li>Core 0 (Prio 1): Task Network WiFi & MQTT loop</li>
                <li>Sinkronisasi data thread-safe menggunakan Mutex</li>
              </ul>
            </div>
          </div>

          {/* Live MQTT Messages Feed */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 col-span-1 lg:col-span-2 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center">
                  <span className="w-2 h-3 bg-cyan-500 rounded mr-1.5 inline-block"></span>
                  Live MQTT Log (awg/*)
                </h3>
                <button
                  onClick={() => setLogs([])}
                  className="text-[11px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Bersihkan Log
                </button>
              </div>

              <div className="bg-gray-900 text-green-400 font-mono text-xs rounded-lg p-3 h-64 overflow-y-auto space-y-1 shadow-inner">
                {logs.length === 0 ? (
                  <div className="text-gray-500 italic py-4 text-center">
                    Menunggu data telemetri MQTT...
                  </div>
                ) : (
                  logs.map((item) => (
                    <div key={item.id} className="flex items-start space-x-2 border-b border-gray-800/80 pb-1">
                      <span className="text-gray-500 text-[10px] shrink-0">[{item.timestamp}]</span>
                      <span className="text-cyan-400 shrink-0 font-medium">{item.topic}:</span>
                      <span className="text-white font-semibold">{item.payload}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-3 flex justify-between items-center text-[11px] text-gray-500 dark:text-gray-400">
              <span>Broker: {activeBroker || primaryBroker}</span>
              <span>Total Diterima: {logs.length} pesan</span>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Konfirmasi Kuras */}
      {isKurasModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6 transform transition-all">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center mx-auto mb-3 text-amber-600 dark:text-amber-400 text-xl">
              ⚠️
            </div>
            <h3 className="text-base font-bold text-center text-gray-900 dark:text-white mb-2">
              Konfirmasi Mode Kuras
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 text-center mb-6">
              Mode kuras akan menyalakan pompa bawah terus menerus untuk mentransfer air ke tangki atas hingga level 100%. Kompresor dan produksi akan dinonaktifkan sementara selama kuras.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setIsKurasModalOpen(false)}
                className="flex-1 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white text-xs font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmKuras}
                className={`flex-1 py-2 rounded-lg text-white text-xs font-semibold transition ${data.kuras ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
              >
                {data.kuras ? 'Hentikan Kuras' : 'Mulai Kuras'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Unlock PIN */}
      {isUnlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-xs w-full overflow-hidden transform transition-all animate-in zoom-in-95">
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">Masukkan PIN Kontrol</h3>
              <button
                onClick={() => setIsUnlockModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <div className={`h-11 bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center text-xl tracking-widest font-mono border-2 ${unlockError ? 'border-red-500 text-red-500' : 'border-transparent text-gray-900 dark:text-white'}`}>
                  {unlockPinInput.split('').map(() => '•').join('') || (
                    <span className="text-gray-400 text-xs font-sans tracking-normal opacity-50">Masukkan PIN</span>
                  )}
                </div>
                {unlockError && <p className="text-red-500 text-xs text-center mt-1.5 font-medium">{unlockError}</p>}
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleUnlockNumberClick(num.toString())}
                    className="h-11 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold text-base hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={handleUnlockClear}
                  className="h-11 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium text-xs uppercase hover:bg-red-100 dark:hover:bg-red-900/40 transition flex items-center justify-center"
                >
                  Clear
                </button>
                <button
                  onClick={() => handleUnlockNumberClick('0')}
                  className="h-11 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold text-base hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                >
                  0
                </button>
                <button
                  onClick={handleUnlockBackspace}
                  className="h-11 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition flex items-center justify-center text-xs"
                >
                  ⌫
                </button>
              </div>

              <button
                onClick={handleUnlockSubmit}
                className="w-full mt-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-xs shadow-md transition"
              >
                Buka Kontrol
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
