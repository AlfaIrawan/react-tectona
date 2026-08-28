/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    // Always apply desktop breakpoint classes. The app is designed at 1920px
    // and uniformly scaled to the window (see uiScale.ts). Viewport media
    // queries would otherwise reflow at 1024×768 (KPI carousel, 2-col grid).
    screens: {
      sm: '1px',
      md: '1px',
      lg: '1px',
      xl: '1px',
      '2xl': '1px',
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      backdropBlur: {
        xs: '2px',
      },
      height: {
        screen: 'var(--app-vh, 100vh)',
      },
      minHeight: {
        screen: 'var(--app-vh, 100vh)',
      },
      maxHeight: {
        screen: 'var(--app-vh, 100vh)',
      },
      width: {
        screen: 'var(--app-vw, 100vw)',
      },
      minWidth: {
        screen: 'var(--app-vw, 100vw)',
      },
      maxWidth: {
        screen: 'var(--app-vw, 100vw)',
      },
    },
  },
  plugins: [],
}
