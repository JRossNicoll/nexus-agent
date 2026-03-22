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
        'n-base': '#0c0e12',
        'n-surface': '#111318',
        'n-raised': '#181b22',
        'n-hover': '#1e2229',
        'n-input': '#14171e',
        'n-accent': '#2d8cff',
        'n-accent-mid': 'rgba(45,140,255,0.10)',
        'n-accent-low': 'rgba(45,140,255,0.06)',
        'n-accent-glow': 'rgba(45,140,255,0.20)',
        'n-text1': '#dde2ec',
        'n-text2': '#7e8899',
        'n-text3': '#45505f',
        'n-text4': '#2c3340',
        'n-green': 'rgba(74,210,149,0.75)',
        'n-amber': 'rgba(235,185,90,0.75)',
        'n-red': 'rgba(235,100,90,0.7)',
        'n-border': 'rgba(255,255,255,0.07)',
        'n-border-mid': 'rgba(255,255,255,0.11)',
        'n-border-bright': 'rgba(255,255,255,0.16)',
        surface: {
          0: '#0c0e12',
          1: '#111318',
          2: '#181b22',
          3: '#1e2229',
          4: '#2c3340',
        },
      },
      fontFamily: {
        ui: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
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
          '0%,100%': { boxShadow: '0 0 18px rgba(45,140,255,0.07)', transform: 'scale(1)' },
          '50%': { boxShadow: '0 0 26px rgba(45,140,255,0.10)', transform: 'scale(1.025)' },
        },
        orbThink: {
          '0%,100%': { boxShadow: '0 0 24px rgba(45,140,255,0.18)', transform: 'scale(1)' },
          '50%': { boxShadow: '0 0 40px rgba(45,140,255,0.35)', transform: 'scale(1.06)' },
        },
        orbTool: {
          '0%,100%': { boxShadow: '0 0 20px rgba(45,140,255,0.22)' },
          '50%': { boxShadow: '0 0 36px rgba(45,140,255,0.45)' },
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
