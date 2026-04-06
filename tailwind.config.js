/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'display': ['"Bebas Neue"', 'cursive'],
        'mono': ['"JetBrains Mono"', 'monospace'],
        'body': ['"Syne"', 'sans-serif'],
      },
      colors: {
        void: '#050505',
        'btn-red': '#cc1100',
        'btn-hot': '#ff2200',
        'btn-glow': 'rgba(255, 30, 0, 0.6)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow-breathe': 'glowBreathe 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        glowBreathe: {
          '0%, 100%': { boxShadow: '0 0 40px 10px rgba(220,17,0,0.3), 0 0 80px 20px rgba(220,17,0,0.1)' },
          '50%': { boxShadow: '0 0 60px 20px rgba(255,34,0,0.6), 0 0 120px 40px rgba(255,34,0,0.2)' },
        }
      }
    },
  },
  plugins: [],
}
