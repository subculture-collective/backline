import { Toaster } from 'react-hot-toast';

export function ThemedToaster() {
    return (
        <Toaster
            position="top-right"
            toastOptions={{
                style: {
                    background: 'rgb(var(--bl-panel))',
                    color: 'rgb(var(--bl-ink))',
                    border: '1px solid rgb(var(--bl-border-strong))',
                    borderRadius: '3px',
                    fontFamily: 'Backline Sans, system-ui, sans-serif',
                },
                success: {
                    iconTheme: {
                        primary: 'rgb(var(--bl-success))',
                        secondary: 'rgb(var(--bl-panel))',
                    },
                },
                error: {
                    iconTheme: {
                        primary: 'rgb(var(--bl-danger))',
                        secondary: 'rgb(var(--bl-panel))',
                    },
                },
            }}
        />
    );
}
