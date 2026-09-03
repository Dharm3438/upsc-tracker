import type { Config } from 'tailwindcss'

/**
 * Warm academic palette. Two rules survive from the original design direction
 * and are worth restating because they constrain everything below:
 *
 *  - Confidence is *depth of fill*, not a red-to-green ramp. Pale means weak,
 *    saturated means strong. The `depth` scale is the only thing that encodes it.
 *  - Alerts are rationed. On a warm ground the old `overdue` brown no longer
 *    reads as a warning, so lateness moves to `danger` (a crimson) and amber is
 *    freed up to be the brand action colour.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Ground and surfaces — warm paper, not grey.
        canvas: '#FBF7F0',
        surface: '#FFFDF9',
        raised: '#FFFFFF',
        hairline: '#E8DFD1',
        edge: '#D6C9B5',

        // Chrome.
        navy: {
          DEFAULT: '#16233A',
          deep: '#0F1929',
          soft: '#243350',
          line: '#2E3D5C',
        },

        // Text.
        ink: '#1C2434',
        muted: '#5A6373',
        faint: '#8C8478',

        // Amber is the action colour.
        accent: {
          DEFAULT: '#B45309',
          hover: '#92400E',
          soft: '#FDF2E0',
          ring: '#E8C79A',
        },

        danger: { DEFAULT: '#A82F2A', soft: '#FBEAE7' },
        success: { DEFAULT: '#2E5A50', soft: '#E8F0EC' },
        info: { DEFAULT: '#2E5171', soft: '#E7EDF3' },

        // Mistake tags are *nominal*, not ordinal — "misread it" is not more
        // of anything than "careless". Five hues, not five steps of one.
        tag: {
          unknown: '#2E5171',
          silly: '#B45309',
          elimination: '#5F7A57',
          misread: '#8A5A83',
          guess: '#8C8478',
        },

        // Sand -> sage -> deep green, so the ramp never collides with the
        // amber accent or the crimson alert.
        depth: {
          1: '#EAE3D5',
          2: '#CBD5C4',
          3: '#9DB7A8',
          4: '#63897B',
          5: '#2E5A50',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces Variable"', 'Fraunces', 'Georgia', 'serif'],
      },
      fontSize: {
        xs: ['12px', '16px'],
        sm: ['13px', '18px'],
        base: ['15px', '22px'],
        lg: ['17px', '24px'],
        xl: ['20px', '28px'],
        '2xl': ['24px', '32px'],
        '3xl': ['30px', '36px'],
        '4xl': ['38px', '44px'],
        '5xl': ['48px', '52px'],
        '6xl': ['60px', '62px'],
      },
      borderRadius: {
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        // Warm-tinted. A neutral black shadow greys the paper ground.
        xs: '0 1px 2px rgba(60,45,25,0.05)',
        sm: '0 1px 3px rgba(60,45,25,0.07), 0 1px 2px rgba(60,45,25,0.04)',
        card: '0 2px 8px rgba(60,45,25,0.06), 0 1px 2px rgba(60,45,25,0.04)',
        lift: '0 6px 18px rgba(60,45,25,0.09), 0 2px 6px rgba(60,45,25,0.05)',
        pop: '0 12px 32px rgba(28,36,52,0.16), 0 2px 8px rgba(28,36,52,0.08)',
        nav: '0 1px 0 rgba(255,255,255,0.06) inset, 0 2px 12px rgba(15,25,41,0.18)',
      },
      spacing: {
        // Load-bearing: h-tap / min-h-tap / w-tap / pb-tap are used ~100 times
        // as the minimum touch target. Never change it.
        tap: '44px',
        // The mobile tab bar and the desktop top nav. The FAB and the toast
        // position themselves against `navbar`, not `tap`, so the bar can grow
        // to fit an icon over a label without them sliding underneath it.
        navbar: '58px',
        topnav: '64px',
      },
      maxWidth: { shell: '1440px', prose: '68ch' },
      transitionDuration: { DEFAULT: '150ms' },
    },
  },
  plugins: [],
} satisfies Config
