'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

interface LogItem {
  id: number
  topic: string
  payload: string
  created_at: string
}

interface BackendStatus {
  db: {
    connected: boolean
    database: string
    host: string
    error: string | null
  }
  mqtt: {
    connected: boolean
    brokerUrl: string
    stats: {
      messagesReceived: number
      messagesSaved: number
      uptimeSeconds: number
      discoveredTopicsCount: number
    }
  }
  recorder: {
    isRecording: boolean
    intervalSeconds: number
    targetTopics: string[]
    recordAllRaw: boolean
    totalLogsInDb: number
  }
}

export default function RecorderPage() {
  const router = useRouter()
  const [status, setStatus] = useState<BackendStatus | null>(null)
  const [backendOnline, setBackendOnline] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [intervalSec, setIntervalSec] = useState<number>(5)
  const [targetTopics, setTargetTopics] = useState<string>('#')
  const [isRecording, setIsRecording] = useState<boolean>(true)
  const [recordAllRaw, setRecordAllRaw] = useState<boolean>(true)

  // Logs table state
  const [logs, setLogs] = useState<LogItem[]>([])
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>('all')
  const [availableTopics, setAvailableTopics] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [totalRecords, setTotalRecords] = useState<number>(0)
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ text, type })
    setTimeout(() => setNotification(null), 3500)
  }

  // Fetch status & config from backend
  const fetchStatus = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/status`)
      if (!res.ok) throw new Error('Backend offline')
      const json = await res.json()
      if (json.success) {
        setStatus(json.data)
        setBackendOnline(true)
        setIsRecording(json.data.recorder.isRecording)
        setIntervalSec(json.data.recorder.intervalSeconds)
        setRecordAllRaw(json.data.recorder.recordAllRaw)
        setTargetTopics(json.data.recorder.targetTopics.join(', '))
      }
    } catch {
      setBackendOnline(false)
    } finally {
      setLoading(false)
    }
  }

  // Fetch list of discovered topics
  const fetchTopics = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/topics`)
      const json = await res.json()
      if (json.success) {
        setAvailableTopics(json.data.topics)
      }
    } catch {
      // Ignore
    }
  }

  // Fetch recorded logs
  const fetchLogs = async (page = 1, topic = selectedTopicFilter) => {
    try {
      let url = `${BACKEND_URL}/api/logs?page=${page}&limit=20`
      if (topic && topic !== 'all') {
        url += `&topic=${encodeURIComponent(topic)}`
      }
      const res = await fetch(url)
      const json = await res.json()
      if (json.success) {
        setLogs(json.data)
        setCurrentPage(json.pagination.page)
        setTotalPages(json.pagination.totalPages)
        setTotalRecords(json.pagination.total)
      }
    } catch {
      // Ignore
    }
  }

  useEffect(() => {
    fetchStatus()
    fetchTopics()
    fetchLogs(1)

    // Polling status dan log secara berkala
    const interval = setInterval(() => {
      fetchStatus()
      fetchLogs(currentPage, selectedTopicFilter)
    }, 4000)

    return () => clearInterval(interval)
  }, [currentPage, selectedTopicFilter])

  // Save Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const topicsArr = targetTopics
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)

      const res = await fetch(`${BACKEND_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intervalSeconds: Number(intervalSec),
          targetTopics: topicsArr.length > 0 ? topicsArr : ['#'],
          isRecording,
          recordAllRaw
        })
      })
      const json = await res.json()
      if (json.success) {
        showToast('Konfigurasi perekaman berhasil disimpan!')
        fetchStatus()
      } else {
        showToast(json.message || 'Gagal menyimpan konfigurasi', 'error')
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Koneksi ke backend gagal', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Toggle Recording On/Off
  const handleToggleRecording = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/recording/toggle`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        setIsRecording(json.data.isRecording)
        showToast(json.message)
        fetchStatus()
      }
    } catch {
      showToast('Gagal mengubah status rekaman', 'error')
    }
  }

  // Clear Logs
  const handleClearLogs = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus data rekaman?')) return
    try {
      const url = selectedTopicFilter !== 'all'
        ? `${BACKEND_URL}/api/logs?topic=${encodeURIComponent(selectedTopicFilter)}`
        : `${BACKEND_URL}/api/logs`
      const res = await fetch(url, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        showToast(json.message)
        fetchLogs(1)
        fetchStatus()
      }
    } catch {
      showToast('Gagal menghapus log', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-8">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white font-medium ${
          notification.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
        }`}>
          {notification.text}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition"
              >
                ← Kembali ke Dashboard
              </button>
              <h1 className="text-2xl font-bold text-sky-400">Perekam Data MQTT (MySQL)</h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Atur interval rekam, filter topik, serta unduh data sensor untuk Tugas Akhir.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`${BACKEND_URL}/api/export?topic=${selectedTopicFilter}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-sm transition shadow"
            >
              📥 Ekspor CSV
            </a>
            <button
              onClick={handleToggleRecording}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition shadow ${
                isRecording
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isRecording ? '⏸ Jeda Rekaman' : '▶ Mulai Rekaman'}
            </button>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Backend Status */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
            <div className="text-xs font-semibold uppercase text-slate-400">Backend Server</div>
            <div className="flex items-center gap-2 mt-2">
              <div className={`w-3 h-3 rounded-full ${backendOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span className="font-semibold text-base">{backendOnline ? 'Online (Port 5000)' : 'Offline'}</span>
            </div>
            <div className="text-xs text-slate-400 mt-1 truncate">{BACKEND_URL}</div>
          </div>

          {/* MySQL Status */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
            <div className="text-xs font-semibold uppercase text-slate-400">Database MySQL</div>
            <div className="flex items-center gap-2 mt-2">
              <div className={`w-3 h-3 rounded-full ${status?.db.connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span className="font-semibold text-base">
                {status?.db.connected ? status.db.database : 'Terputus'}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1 truncate">
              {status?.db.connected ? `${status.db.host}` : (status?.db.error || 'Periksa .env backend')}
            </div>
          </div>

          {/* MQTT Status */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
            <div className="text-xs font-semibold uppercase text-slate-400">MQTT Broker</div>
            <div className="flex items-center gap-2 mt-2">
              <div className={`w-3 h-3 rounded-full ${status?.mqtt.connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span className="font-semibold text-base">
                {status?.mqtt.connected ? 'Terhubung' : 'Terputus'}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1 truncate">
              {status?.mqtt.brokerUrl || 'mqtt://127.0.0.1:1883'}
            </div>
          </div>

          {/* Total Logs */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
            <div className="text-xs font-semibold uppercase text-slate-400">Total Baris di DB</div>
            <div className="font-bold text-2xl text-sky-400 mt-1">
              {status?.recorder.totalLogsInDb?.toLocaleString() || totalRecords.toLocaleString() || 0}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Status: {isRecording ? '🟢 Aktif Merekam' : '🟡 Sedang Dijeda'}
            </div>
          </div>
        </div>

        {/* Konfigurasi Interval & Topik */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-md">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            ⚙️ Pengaturan Interval & Target Topik Rekam
          </h2>

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Interval Input */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Interval Perekaman per Topik (Detik):
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="3600"
                    value={intervalSec}
                    onChange={(e) => setIntervalSec(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-32 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500 font-mono"
                  />
                  <span className="text-slate-400 text-sm">
                    {intervalSec === 0 ? '⚡ Real-time (Setiap data masuk langsung dicatat)' : `Setiap ${intervalSec} detik sekali`}
                  </span>
                </div>
                {/* Preset intervals */}
                <div className="flex gap-2 mt-2">
                  {[0, 1, 5, 10, 30, 60].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setIntervalSec(sec)}
                      className={`px-2.5 py-1 text-xs rounded border transition ${
                        intervalSec === sec
                          ? 'bg-sky-600 border-sky-500 text-white'
                          : 'bg-slate-700/60 border-slate-600 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {sec === 0 ? 'Real-time' : `${sec}s`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Topics */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Topik yang Direkam (Pisahkan koma, gunakan '#' untuk semua topik):
                </label>
                <input
                  type="text"
                  value={targetTopics}
                  onChange={(e) => setTargetTopics(e.target.value)}
                  placeholder="Contoh: sensor/water, sensor/temp, pzem004t/# atau #"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500 font-mono text-sm"
                />

                {/* Quick Add Discovered Topics */}
                {availableTopics.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-slate-400">Topik Terdeteksi di MQTT: </span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {availableTopics.slice(0, 10).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            const cur = targetTopics.split(',').map(x => x.trim()).filter(Boolean)
                            if (!cur.includes(t)) {
                              setTargetTopics(cur.length > 0 && cur[0] !== '#' ? [...cur, t].join(', ') : t)
                            }
                          }}
                          className="px-2 py-0.5 text-xs bg-slate-700 hover:bg-sky-700 text-slate-300 rounded border border-slate-600 transition"
                        >
                          + {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-700">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recordAllRaw}
                  onChange={(e) => setRecordAllRaw(e.target.checked)}
                  className="rounded border-slate-600 text-sky-500 focus:ring-sky-500"
                />
                Rekam seluruh raw data di topik <code className="text-sky-300">#</code> ke database
              </label>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-lg text-sm transition shadow disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : '💾 Terapkan Konfigurasi'}
              </button>
            </div>
          </form>
        </div>

        {/* Tabel Data Rekaman */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">📋 Data Rekaman di MySQL</h2>
              <p className="text-slate-400 text-xs">
                Menampilkan {logs.length} dari {totalRecords} total baris data
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter Topik */}
              <select
                value={selectedTopicFilter}
                onChange={(e) => {
                  setSelectedTopicFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
              >
                <option value="all">Semua Topik</option>
                {availableTopics.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              {/* Refresh Button */}
              <button
                onClick={() => fetchLogs(currentPage, selectedTopicFilter)}
                className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition"
                title="Muat Ulang Data"
              >
                🔄
              </button>

              {/* Clear Logs */}
              <button
                onClick={handleClearLogs}
                className="px-3 py-1.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/60 rounded-lg text-sm transition"
              >
                🗑 Hapus Data
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto border border-slate-700 rounded-lg">
            <table className="w-full text-left text-sm text-slate-200">
              <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3 w-16">ID</th>
                  <th className="px-4 py-3 w-48">Topik</th>
                  <th className="px-4 py-3">Raw Data / Payload</th>
                  <th className="px-4 py-3 w-48 text-right">Waktu (Timestamp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-500">
                      Belum ada data rekaman di database. Pastikan MQTT broker dan MySQL terhubung.
                    </td>
                  </tr>
                ) : (
                  logs.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-700/40 transition">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{row.id}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-sky-400 font-medium">
                        {row.topic}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs max-w-md truncate" title={row.payload}>
                        {row.payload}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-400 text-right whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-400 pt-2">
              <span>Halaman {currentPage} dari {totalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded transition"
                >
                  Sebelumnya
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded transition"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
