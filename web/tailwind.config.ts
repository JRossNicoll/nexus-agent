import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'n-base': '#0a0a0a',
        'n-surface': '#111111',
        'n-raised': '#1a1a1a',
        'n-hover': '#222222',
        'n-input': '#1a1a1a',
        'n-accent': '#ff3333',
        'n-accent-mid': 'rgba(255,51,51,0.10)',
        'n-accent-low': 'rgba(255,51,51,0.05)',
        'n-accent-glow': 'rgba(255,51,51,0.20)',
        'n-text1': '#f5f5f5',
        'n-text2': '#999999',
        'n-text3': '#888888',
        'n-text4': '#666666',
        'n-green': '#5ec26a',
        'n-amber': '#ebb95a',
        'n-red': '#eb645a',
        'n-border': '#2a2a2a',
        'n-border-mid': '#333333',
        'n-border-bright': '#444444',
        surface: {
          0: '#0a0a0a',
          1: '#111111',
          2: '#1a1a1a',
          3: '#222222',
          4: '#333333',
        },
      },
      fontFamily: {
        ui: ['Inter', 'Geist', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Geist Mono', 'monospace'],
        sans: ['Inter', 'Geist', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'slide-left': 'slideLeft 0.3s ease-out',
        'palette-in': 'paletteIn 0.15s ease-out',
        'orb-idle': 'orbIdle 4s ease-in-out infinite',
        'orb-think': 'orbThink 1.5s ease-in-out infinite',
        'orb-tool': 'orbTool 1s ease-in-out infinite',
        'cursor-blink': 'cursorBlink 0.9s infinite',
        'trace-pulse': 'tracePulse 1.2s ease-in-out infinite',
        'beam': 'beam 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideLeft: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        paletteIn: {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(-8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        orbIdle: {
          '0%,100%': { boxShadow: '0 0 18px rgba(255,51,51,0.07)', transform: 'scale(1)' },
          '50%': { boxShadow: '0 0 26px rgba(255,51,51,0.10)', transform: 'scale(1.025)' },
        },
        orbThink: {
          '0%,100%': { boxShadow: '0 0 24px rgba(255,51,51,0.18)', transform: 'scale(1)' },
          '50%': { boxShadow: '0 0 40px rgba(255,51,51,0.35)', transform: 'scale(1.06)' },
        },
        orbTool: {
          '0%,100%': { boxShadow: '0 0 20px rgba(255,51,51,0.22)' },
          '50%': { boxShadow: '0 0 36px rgba(255,51,51,0.45)' },
        },
        cursorBlink: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        tracePulse: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        beam: {
          '0%,100%': { opacity: '0.4', transform: 'scaleY(1)' },
          '50%': { opacity: '0.7', transform: 'scaleY(1.08)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
