/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                bl: {
                    canvas: 'rgb(var(--bl-canvas) / <alpha-value>)',
                    recessed: 'rgb(var(--bl-recessed) / <alpha-value>)',
                    deep: 'rgb(var(--bl-deep) / <alpha-value>)',
                    panel: 'rgb(var(--bl-panel) / <alpha-value>)',
                    surface: 'rgb(var(--bl-surface) / <alpha-value>)',
                    border: 'rgb(var(--bl-border) / <alpha-value>)',
                    ink: 'rgb(var(--bl-ink) / <alpha-value>)',
                    muted: 'rgb(var(--bl-muted) / <alpha-value>)',
                    accent: 'rgb(var(--bl-accent) / <alpha-value>)',
                    action: 'rgb(var(--bl-action) / <alpha-value>)',
                    success: 'rgb(var(--bl-success) / <alpha-value>)',
                    warning: 'rgb(var(--bl-warning) / <alpha-value>)',
                    'success-solid':
                        'rgb(var(--bl-success-solid) / <alpha-value>)',
                    'warning-solid':
                        'rgb(var(--bl-warning-solid) / <alpha-value>)',
                    'danger-solid':
                        'rgb(var(--bl-danger-solid) / <alpha-value>)',
                    'on-action': 'rgb(var(--bl-on-action) / <alpha-value>)',
                    hardware: 'rgb(var(--bl-hardware) / <alpha-value>)',
                    danger: 'rgb(var(--bl-danger) / <alpha-value>)',
                },
            },
            fontFamily: {
                sans: ['Backline Sans', 'system-ui', 'sans-serif'],
                display: ['Backline Display', 'Arial Narrow', 'sans-serif'],
                mono: ['Backline Mono', 'monospace'],
            },
            borderRadius: { lg: '0.1875rem', xl: '0.25rem', '2xl': '0.375rem' },
        },
    },
    plugins: [],
};
