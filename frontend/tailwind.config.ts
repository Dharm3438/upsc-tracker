import type { Config } from 'tailwindcss'

// Tokens from the plan's design direction (§10). Confidence is depth of fill,
// not a red-to-green ramp: pale means weak, saturated means strong.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#171A1F',
        slate: '#5B6470',
        line: '#DFE3E8',
        paper: '#F4F6F8',
        surface: '#FFFFFF',
        signal: '#2B44C7',
        overdue: '#B4531F',
        depth: {
          1: '#E3E8EE',
          2: '#BFD0DA',
          3: '#8FB0BF',
          4: '#5A8399',
          5: '#1F4D63',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['12px', '16px'],
        sm: ['14px', '20px'],
        base: ['16px', '24px'],
        lg: ['20px', '28px'],
        xl: ['28px', '34px'],
      },
      spacing: { tap: '44px' },
    },
  },
  plugins: [],
} satisfies Config
