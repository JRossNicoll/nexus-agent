'use client';

import { useState } from 'react';

interface HomeScreenProps {
  onSend: (message: string) => void;
  onNavigate: (tab: string) => void;
}

const quickActions = [
  { label: 'Summarise my week', icon: '📋' },
  { label: 'What do you know about me?', icon: '🧠' },
  { label: 'Create a new skill', icon: '⚡' },
  { label: 'Search my memories', icon: '🔍' },
];

export default function HomeScreen({ onSend, onNavigate }: HomeScreenProps) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Light beam behind logo */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 2,
        height: '35%',
        background: 'linear-gradient(to bottom, rgba(45,140,255,0.18), rgba(45,140,255,0.03), transparent)',
        animation: 'beam 3s ease-in-out infinite',
      }} />

      {/* Logo */}
      <div style={{ marginBottom: 32, position: 'relative' }}>
        <svg width="52" height="52" viewBox="0 0 26 26" fill="none">
          <path d="M13 2L3 7.5V18.5L13 24L23 18.5V7.5L13 2Z" stroke="rgba(45,140,255,0.52)" strokeWidth="1.1" fill="none"/>
          <path d="M13 7L7 10.5V15.5L13 19L19 15.5V10.5L13 7Z" fill="rgba(45,140,255,0.07)" stroke="rgba(45,140,255,0.32)" strokeWidth="0.8"/>
          <circle cx="13" cy="13" r="2.2" fill="rgba(45,140,255,0.88)"/>
        </svg>
        {/* Glow */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 80, height: 80,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(45,140,255,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Headline */}
      <h1 style={{
        fontSize: 22,
        fontWeight: 500,
        color: 'var(--text-1)',
        marginBottom: 6,
        letterSpacing: '-0.01em',
      }}>
        How can I help you today?
      </h1>
      <p style={{
        fontSize: 13,
        color: 'var(--text-3)',
        marginBottom: 32,
        fontFamily: 'var(--font-mono)',
      }}>
        Ask me anything, or pick a quick action below
      </p>

      {/* Input card */}
      <div style={{
        width: '100%',
        maxWidth: 540,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-mid)',
        borderRadius: 'var(--r-lg)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 24,
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask NEXUS anything..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-1)',
            fontSize: 14,
            fontFamily: 'var(--font-ui)',
          }}
        />
        <div style={{
          fontSize: 10,
          color: 'var(--text-3)',
          fontFamily: 'var(--font-mono)',
          padding: '3px 8px',
          background: 'var(--bg-raised)',
          borderRadius: 'var(--r-sm)',
          border: '1px solid var(--border)',
          whiteSpace: 'nowrap',
        }}>
          ⌘K
        </div>
        <button
          onClick={handleSubmit}
          style={{
            width: 32, height: 32,
            borderRadius: 'var(--r-sm)',
            background: 'var(--accent)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>

      {/* Quick action chips */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
        maxWidth: 540,
      }}>
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => onSend(action.label)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 'var(--r-md)',
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
              fontSize: 12.5,
              fontFamily: 'var(--font-ui)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-mid)';
              e.currentTarget.style.color = 'var(--text-1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text-2)';
            }}
          >
            <span style={{ fontSize: 14 }}>{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes beam {
          0%, 100% { opacity: 0.4; transform: translateX(-50%) scaleY(1); }
          50% { opacity: 0.7; transform: translateX(-50%) scaleY(1.08); }
        }
      `}</style>
    </div>
  );
}
