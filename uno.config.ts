import { defineConfig, presetIcons, presetTypography, presetUno } from 'unocss';

export default defineConfig({
  presets: [presetUno(), presetIcons(), presetTypography()],
  theme: {
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
      popover: {
        DEFAULT: 'hsl(var(--popover))',
        foreground: 'hsl(var(--popover-foreground))',
      },
      card: {
        DEFAULT: 'hsl(var(--card))',
        foreground: 'hsl(var(--card-foreground))',
      },
      success: {
        DEFAULT: 'hsl(var(--success))',
        foreground: 'hsl(var(--success-foreground))',
      },
      warning: {
        DEFAULT: 'hsl(var(--warning))',
        foreground: 'hsl(var(--warning-foreground))',
      },
      info: {
        DEFAULT: 'hsl(var(--info))',
        foreground: 'hsl(var(--info-foreground))',
      },
      sticky: {
        yellow: 'hsl(var(--sticky-yellow))',
        blue: 'hsl(var(--sticky-blue))',
        green: 'hsl(var(--sticky-green))',
        pink: 'hsl(var(--sticky-pink))',
        purple: 'hsl(var(--sticky-purple))',
        orange: 'hsl(var(--sticky-orange))',
      },
      console: {
        log: 'hsl(var(--console-log))',
        info: 'hsl(var(--console-info))',
        warn: 'hsl(var(--console-warn))',
        error: 'hsl(var(--console-error))',
        debug: 'hsl(var(--console-debug))',
        trace: 'hsl(var(--console-trace))',
      },
    },
    borderRadius: {
      lg: 'var(--radius)',
      md: 'calc(var(--radius) - 2px)',
      sm: 'calc(var(--radius) - 4px)',
    },
    animation: {
      'border-pulse': 'border-pulse 3s ease-in-out infinite',
      'border-pulse-fast': 'border-pulse-fast 1.5s ease-in-out infinite',
    },
    keyframes: {
      'border-pulse': {
        '0%, 100%': { opacity: '0.6' },
        '50%': { opacity: '1' },
      },
      'border-pulse-fast': {
        '0%, 100%': { opacity: '0.8' },
        '50%': { opacity: '1' },
      },
    },
  },
  content: {
    pipeline: {
      include: [/\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html)($|\?)/, 'src/**/*.ts'],
    },
  },
  preflights: [
    {
      getCSS: () => `
        @keyframes yolo-flow {
          0% { border-color: #22d3ee; }
          33% { border-color: #f472b6; }
          66% { border-color: #fbbf24; }
          100% { border-color: #22d3ee; }
        }
        .yolo-button-active {
          animation: yolo-flow 1.5s ease-in-out infinite;
          border: 2px solid;
        }
        .yolo-button-active > * {
          color: white;
        }
        .yolo-button-active svg {
          fill: white;
        }
        :root {
          --background: 210 33% 99%;
          --foreground: 222 47% 11%;
          --card: 0 0% 100%;
          --card-foreground: 222 47% 11%;
          --popover: 0 0% 100%;
          --popover-foreground: 222 47% 11%;
          --primary: 224 71% 44%;
          --primary-foreground: 0 0% 100%;
          --secondary: 215 32% 92%;
          --secondary-foreground: 222 47% 11%;
          --muted: 216 33% 96%;
          --muted-foreground: 218 18% 44%;
          --accent: 217 32% 95%;
          --accent-foreground: 222 47% 11%;
          --destructive: 0 78% 54%;
          --destructive-foreground: 0 0% 100%;
          --border: 216 27% 88%;
          --input: 216 27% 88%;
          --ring: 224 71% 52%;
          --success: 160 72% 34%;
          --success-foreground: 210 40% 98%;
          --warning: 36 92% 50%;
          --warning-foreground: 210 40% 98%;
          --info: 199 89% 48%;
          --info-foreground: 210 40% 98%;
          --radius: 0.75rem;
          --gradient-start: #0891b2;
          --gradient-middle: #db2777;
          --gradient-end: #d97706;
          /* 便签调色板 */
          --sticky-yellow: 54 90% 92%;
          --sticky-blue: 213 90% 95%;
          --sticky-green: 142 60% 92%;
          --sticky-pink: 330 90% 92%;
          --sticky-purple: 270 80% 93%;
          --sticky-orange: 30 90% 93%;
          /* 控制台日志颜色 */
          --console-log: 142 76% 36%;
          --console-info: 221 83% 53%;
          --console-warn: 38 92% 50%;
          --console-error: 0 84% 50%;
          --console-debug: 270 80% 65%;
          --console-trace: 215 14% 56%;
        }
        .dark {
          --background: 222 28% 9%;
          --foreground: 210 36% 96%;
          --card: 222 24% 13%;
          --card-foreground: 210 36% 96%;
          --popover: 222 24% 12%;
          --popover-foreground: 210 36% 96%;
          --primary: 224 89% 68%;
          --primary-foreground: 222 47% 11%;
          --secondary: 218 18% 20%;
          --secondary-foreground: 210 36% 96%;
          --muted: 220 18% 16%;
          --muted-foreground: 214 18% 78%;
          --accent: 220 18% 19%;
          --accent-foreground: 210 36% 96%;
          --destructive: 0 72% 54%;
          --destructive-foreground: 210 40% 98%;
          --border: 217 16% 25%;
          --input: 217 16% 25%;
          --ring: 224 89% 68%;
          --success: 160 76% 44%;
          --success-foreground: 164 86% 10%;
          --warning: 44 96% 60%;
          --warning-foreground: 26 83% 14%;
          --info: 199 89% 64%;
          --info-foreground: 222 47% 11%;
          --gradient-start: #22d3ee;
          --gradient-middle: #f472b6;
          --gradient-end: #fbbf24;
          /* 便签调色板 - 深色版本 */
          --sticky-yellow: 48 89% 30%;
          --sticky-blue: 217 91% 30%;
          --sticky-green: 142 70% 30%;
          --sticky-pink: 330 80% 35%;
          --sticky-purple: 270 65% 40%;
          --sticky-orange: 30 90% 35%;
          /* 控制台日志颜色 - 深色版本 */
          --console-log: 142 70% 55%;
          --console-info: 217 91% 60%;
          --console-warn: 48 95% 55%;
          --console-error: 0 72% 50%;
          --console-debug: 270 80% 65%;
          --console-trace: 215 20% 65%;
        }
      `,
    },
  ],
});
