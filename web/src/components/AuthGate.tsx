'use client';

import { useState } from 'react';
import { Hexagon, Lock, Eye, EyeOff } from 'lucide-react';
import { authAPI } from '@/lib/api';

interface AuthGateProps {
  onAuthenticated: () => void;
}

export default function AuthGate({ onAuthenticated }: AuthGateProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [isSetup, setIsSetup] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.length < 4) {
      setError('PIN must be at least 4 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isSetup) {
        const result = await authAPI.setup(pin);
        if (result.success) {
          onAuthenticated();
        } else {
          setError('Failed to set up PIN');
        }
      } else {
        const result = await authAPI.verify(pin);
        if (result.authenticated) {
          onAuthenticated();
        } else {
          setError('Invalid PIN');
        }
      }
    } catch {
      setError('Connection error. Is the gateway running?');
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center h-screen bg-surface-0">
      <div className="w-full max-w-sm mx-4">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-500/25 mb-4">
            <Hexagon className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">NEXUS</h1>
          <p className="text-sm text-gray-500">
            {isSetup ? 'Set up your PIN to secure NEXUS' : 'Enter your PIN to continue'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type={showPin ? 'text' : 'password'}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN..."
              autoFocus
              className="w-full pl-10 pr-12 py-3 bg-surface-2 border border-white/[0.08] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || pin.length < 4}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl text-sm font-medium hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
          >
            {loading ? 'Verifying...' : isSetup ? 'Set PIN' : 'Unlock'}
          </button>
        </form>

        <button
          onClick={() => setIsSetup(!isSetup)}
          className="w-full mt-4 text-center text-xs text-gray-600 hover:text-gray-400"
        >
          {isSetup ? 'Already have a PIN? Sign in' : 'First time? Set up PIN'}
        </button>
      </div>
    </div>
  );
}
