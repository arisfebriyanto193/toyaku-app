"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'react-qr-code'

export default function InfoPage() {
    const router = useRouter()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [pinInput, setPinInput] = useState('')
    const [showPasswords, setShowPasswords] = useState(false)
    const [error, setError] = useState('')

    // Environment variables
    const config = {
        ssid: process.env.NEXT_PUBLIC_SSID || '-',
        passWifi: process.env.NEXT_PUBLIC_PASS || '******',
        ipRouter: process.env.NEXT_PUBLIC_IP_ROUTER || '-',
        passRouter: process.env.NEXT_PUBLIC_PASS_ROUTER || '******',
        ipServer: process.env.NEXT_PUBLIC_IP_SERVER || '-',
        passUbuntu: process.env.NEXT_PUBLIC_PAS_UBUNTU || '******',
        userUbuntu: process.env.NEXT_PUBLIC_USER || '-',
        brokerMqtt1: process.env.NEXT_PUBLIC_BROKER_URL || '-',
        brokerMqtt2: process.env.NEXT_PUBLIC_BROKER2_URL || '-',
        truePin: process.env.NEXT_PUBLIC_INFO_PIN || '123456',
        domain: process.env.NEXT_PUBLIC_DOMAIN || '-'
    }
    const handleMaskedValue = (value: string) => {
        return showPasswords ? value : '••••••••'
    }

    const handlePinSubmit = () => {
        if (pinInput === config.truePin) {
            setShowPasswords(true)
            setIsModalOpen(false)
            setPinInput('')
            setError('')
        } else {
            setError('PIN Salah!')
            setPinInput('')
        }
    }

    const handleNumberClick = (num: string) => {
        if (pinInput.length < 6) {
            setPinInput(prev => prev + num)
            setError('')
        }
    }

    const handleClear = () => {
        setPinInput('')
        setError('')
    }

    const handleBackspace = () => {
        setPinInput(prev => prev.slice(0, -1))
        setError('')
    }

    const toggleVisibility = () => {
        if (showPasswords) {
            setShowPasswords(false)
        } else {
            setIsModalOpen(true)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header with Back Button */}
                <div className="flex items-center space-x-4 mb-8">
                    <button
                        onClick={() => router.push('/')}
                        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Informasi Sistem</h1>
                </div>

                {/* Network Information Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                    <div className="bg-blue-50 dark:bg-blue-900/20 px-6 py-4 border-b border-blue-100 dark:border-blue-800/30">
                        <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-300 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                            </svg>
                            Jaringan & Router
                        </h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">SSID (WiFi)</label>
                                <div className="mt-1 text-gray-900 dark:text-white font-medium">{config.ssid}</div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Password WiFi</label>
                                <div className="mt-1 text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-gray-700 px-3 py-1 rounded inline-block">
                                    {handleMaskedValue(config.passWifi)}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">IP Router</label>
                                <div className="mt-1 text-gray-900 dark:text-white font-mono">{config.ipRouter}</div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Password Router</label>
                                <div className="mt-1 text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-gray-700 px-3 py-1 rounded inline-block">
                                    {handleMaskedValue(config.passRouter)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Server Information Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                    <div className="bg-purple-50 dark:bg-purple-900/20 px-6 py-4 border-b border-purple-100 dark:border-purple-800/30">
                        <h2 className="text-lg font-semibold text-purple-800 dark:text-purple-300 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                            </svg>
                            Server Ubuntu
                        </h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">IP Server</label>
                                <div className="mt-1 text-gray-900 dark:text-white font-mono">{config.ipServer}</div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">User Ubuntu</label>
                                <div className="mt-1 text-gray-900 dark:text-white font-medium">{config.userUbuntu}</div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Broker MQTT 1</label>
                                <div className="mt-1 text-gray-900 dark:text-white font-medium">{config.brokerMqtt1}</div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Broker MQTT 2</label>
                                <div className="mt-1 text-gray-900 dark:text-white font-medium">{config.brokerMqtt2}</div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Password Ubuntu</label>
                                <div className="mt-1 text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-gray-700 px-3 py-1 rounded inline-block">
                                    {handleMaskedValue(config.passUbuntu)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Domain & QR Code Card */}
                {config.domain !== '-' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                        <div className="bg-green-50 dark:bg-green-900/20 px-6 py-4 border-b border-green-100 dark:border-green-800/30">
                            <h2 className="text-lg font-semibold text-green-800 dark:text-green-300 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                </svg>
                                Akses Publik (Domain)
                            </h2>
                        </div>
                        <div className="p-6">
                            <div className="flex flex-col md:flex-row items-center md:items-start md:space-x-8 space-y-6 md:space-y-0 text-center md:text-left">
                                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                                    <QRCode value={config.domain} size={150} />
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                            Anda dapat mengakses dashboard ini melalui domain publik berikut:
                                        </p>
                                        <a
                                            href={config.domain}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-lg font-bold text-blue-600 dark:text-blue-400 hover:underline break-all"
                                        >
                                            {config.domain}
                                        </a>
                                    </div>
                                    <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                                        Scan QR Code di samping menggunakan smartphone untuk membuka dashboard secara langsung.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Toggle Button */}
                <div className="flex justify-center pt-4">
                    <button
                        onClick={toggleVisibility}
                        className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all shadow-md active:scale-95 ${showPasswords
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                    >
                        {showPasswords ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                                <span>Sembunyikan Informasi Sensitif</span>
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <span>Lihat Password (PIN)</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* PIN Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-xs w-full overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 dark:text-white">Masukkan PIN</h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6">
                            {/* PIN Display */}
                            <div className="mb-6">
                                <div className={`h-12 bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center text-2xl tracking-widest font-mono border-2 ${error ? 'border-red-500 text-red-500' : 'border-transparent text-gray-900 dark:text-white'}`}>
                                    {pinInput.split('').map(() => '•').join('') || (
                                        <span className="text-gray-400 text-sm font-sans tracking-normal opacity-50">Masukkan 6-digit PIN</span>
                                    )}
                                </div>
                                {error && <p className="text-red-500 text-xs text-center mt-2 font-medium">{error}</p>}
                            </div>

                            {/* Pad */}
                            <div className="grid grid-cols-3 gap-3">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                    <button
                                        key={num}
                                        onClick={() => handleNumberClick(num.toString())}
                                        className="h-12 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold text-lg hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-blue-100 dark:active:bg-blue-900 transition-colors"
                                    >
                                        {num}
                                    </button>
                                ))}
                                <button
                                    onClick={handleClear}
                                    className="h-12 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium text-xs uppercase hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center"
                                >
                                    Clear
                                </button>
                                <button
                                    onClick={() => handleNumberClick('0')}
                                    className="h-12 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold text-lg hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-blue-100 dark:active:bg-blue-900 transition-colors"
                                >
                                    0
                                </button>
                                <button
                                    onClick={handleBackspace}
                                    className="h-12 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                                    </svg>
                                </button>
                            </div>

                            {/* Submit Button */}
                            <button
                                onClick={handlePinSubmit}
                                className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-md transition-all active:scale-[0.98]"
                            >
                                Konfirmasi PIN
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
