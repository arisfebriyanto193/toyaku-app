"use client";

import React, { useState, useEffect, useRef } from 'react';
import mqtt, { MqttClient } from 'mqtt';

// --- Types ---
interface EnergyData {
  voltage: string;
  current: string;
  power: string;
  energy: string;
  pf: string;
  frequency: string;
}

const BROKERS = [
  { url: 'ws://192.168.1.100:9001', name: 'Primary Broker (QByte)' },
  { url: 'ws://localhost:9001', name: 'Secondary Broker (Local)' }
];

export default function EnergyMonitor() {
  // --- State ---
  const [data, setData] = useState<EnergyData>({
    voltage: '0.00', current: '0.00', power: '0.00', energy: '0.00', pf: '0.00', frequency: '0.00'
  });
  const [status, setStatus] = useState({ type: 'connecting', text: 'Connecting...', broker: '' });
  const [lastUpdated, setLastUpdated] = useState('-');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [resetStatus, setResetStatus] = useState('Reset Energy');

  // Refs for MQTT
  const clientRef = useRef<MqttClient | null>(null);
  const brokerIndexRef = useRef(0);
  const reconnectAttemptsRef = useRef(0);

  // --- Theme Logic ---
  useEffect(() => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) setIsDarkMode(true);
  }, []);

  // --- MQTT Logic ---
  const connectMQTT = () => {
    const broker = BROKERS[brokerIndexRef.current];
    setStatus({ type: 'connecting', text: 'Connecting...', broker: broker.name });

    if (clientRef.current) clientRef.current.end();

    const client = mqtt.connect(broker.url, {
      connectTimeout: 5000,
      reconnectPeriod: 0,
    });

    client.on('connect', () => {
      reconnectAttemptsRef.current = 0;
      setStatus({ type: 'connected', text: 'Connected to MQTT', broker: broker.name });
      client.subscribe('pzem004t/#');
    });

    client.on('message', (topic, message) => {
      const val = parseFloat(message.toString()).toFixed(2);
      const timeString = new Date().toLocaleTimeString('en-GB');
      
      setLastUpdated(timeString);
      setData(prev => ({
        ...prev,
        [topic.replace('pzem004t/', '')]: val
      }));
    });

    client.on('error', () => tryNextBroker());
    client.on('close', () => {
      if (reconnectAttemptsRef.current < 3) setTimeout(tryNextBroker, 2000);
    });

    clientRef.current = client;
  };

  const tryNextBroker = () => {
    reconnectAttemptsRef.current++;
    if (reconnectAttemptsRef.current >= 3) {
      brokerIndexRef.current = (brokerIndexRef.current + 1) % BROKERS.length;
      reconnectAttemptsRef.current = 0;
    }
    connectMQTT();
  };

  useEffect(() => {
    connectMQTT();
    return () => { clientRef.current?.end(); };
  }, []);

  const handleReset = () => {
    if (clientRef.current?.connected) {
      clientRef.current.publish('pzem004t/energy/reset', 'reset');
      setResetStatus('Resetting...');
      setTimeout(() => setResetStatus('Complete!'), 1500);
      setTimeout(() => setResetStatus('Reset Energy'), 3000);
    } else {
      setResetStatus('Not Connected');
      setTimeout(() => setResetStatus('Reset Energy'), 2000);
    }
  };

  // --- UI Components ---
  const Card = ({ title, value, unit, icon, colorClass, progress, footer }: any) => (
    <div className={`group relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-3xl shadow-xl border border-white/20 dark:border-gray-700/20 overflow-hidden hover:shadow-2xl transition-all duration-500 transform hover:scale-[1.02]`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${colorClass} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}></div>
      <div className="relative p-8">
        <div className="flex items-center justify-between mb-6">
          <div className={`p-4 rounded-2xl bg-gray-100 dark:bg-gray-700 shadow-lg text-2xl`}>{icon}</div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
            <div className="flex items-baseline">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white">{value}</h2>
              {unit && <span className="text-lg text-gray-500 dark:text-gray-400 ml-2">{unit}</span>}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
            <div 
              className={`h-full bg-gradient-to-r ${colorClass.replace('from-', 'bg-')} transition-all duration-1000 ease-out`} 
              style={{ width: `${Math.min(100, progress)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">{footer}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`${isDarkMode ? 'dark' : ''}`}>
      <div className="bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-900 dark:to-indigo-900 min-h-screen transition-colors duration-500 text-gray-900 dark:text-white">
        
        {/* Animated Orbs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        </div>

        <div className="container mx-auto px-4 py-8 relative">
          {/* Header */}
          <header className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
            <div className="flex items-center">
              <div className="mr-6 p-3 rounded-2xl bg-blue-500 text-white shadow-lg animate-bounce-slow">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div>
                <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">Toyaku Energy</h1>
                <p className="text-gray-600 dark:text-gray-400 font-medium">Real-time Monitoring System</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button onClick={handleReset} className="px-6 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-semibold shadow-lg transition-all transform hover:scale-105 active:scale-95">
                {resetStatus}
              </button>
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 rounded-2xl bg-white dark:bg-gray-800 shadow-lg text-xl transition-transform hover:rotate-12">
                {isDarkMode ? '🌙' : '☀️'}
              </button>
            </div>
          </header>

          {/* Connection Status */}
          <div className="mb-12 p-6 rounded-3xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-md border border-white/20 shadow-xl">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full mr-4 animate-pulse ${status.type === 'connected' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <div>
                  <h3 className="font-bold text-lg">{status.text}</h3>
                  <p className="text-sm opacity-70">Broker: {status.broker}</p>
                </div>
              </div>
              <div className="text-center md:text-right">
                <p className="text-xs uppercase tracking-wider opacity-50">Last Update</p>
                <p className="text-xl font-mono font-bold">{lastUpdated}</p>
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card title="Voltage" value={data.voltage} unit="V" icon="⚡" colorClass="from-blue-500" progress={(parseFloat(data.voltage)/250)*100} footer="Range: 0-250V" />
            <Card title="Current" value={data.current} unit="A" icon="🌊" colorClass="from-emerald-500" progress={(parseFloat(data.current)/10)*100} footer="Range: 0-10A" />
            <Card title="Power" value={data.power} unit="W" icon="🔥" colorClass="from-orange-500" progress={(parseFloat(data.power)/2000)*100} footer="Range: 0-2000W" />
            <Card title="Energy" value={data.energy} unit="kWh" icon="🔋" colorClass="from-purple-500" progress={(parseFloat(data.energy)/100)*100} footer="Accumulated Total" />
            <Card title="Power Factor" value={data.pf} icon="🎯" colorClass="from-pink-500" progress={parseFloat(data.pf)*100} footer="Efficiency (0-1.0)" />
            <Card title="Frequency" value={data.frequency} unit="Hz" icon="⏲️" colorClass="from-cyan-500" progress={((parseFloat(data.frequency)-45)/10)*100} footer="Line Freq: 45-55Hz" />
          </div>
        </div>
      </div>
    </div>
  );
}