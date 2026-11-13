import * as Sentry from '@sentry/react';
import { Component, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary component that catches React errors and reports them to Sentry
 * Provides a fallback UI when an error occurs
 */
class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        // Report to Sentry
        Sentry.captureException(error, {
            contexts: {
                react: {
                    componentStack: errorInfo.componentStack,
                },
            },
        });

        console.error('Error caught by boundary:', error, errorInfo);
    }

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
        });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <div className="flex min-h-screen items-center justify-center bg-bl-canvas p-4">
                    <div className="w-full max-w-md rounded-lg border border-bl-panel bg-bl-recessed p-6 shadow-lg">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="rounded-full bg-bl-danger/10 p-3">
                                <svg
                                    className="h-6 w-6 text-bl-danger"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                </svg>
                            </div>
                            <h2 className="text-xl font-semibold text-bl-ink">
                                Something went wrong
                            </h2>
                        </div>

                        <p className="mb-4 text-sm text-bl-muted">
                            We're sorry, but something unexpected happened. The
                            error has been reported and we'll look into it.
                        </p>

                        {this.state.error && import.meta.env.DEV && (
                            <div className="mb-4 rounded bg-bl-panel p-3">
                                <p className="text-xs font-mono text-bl-muted break-words">
                                    {this.state.error.message}
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 rounded bg-bl-action px-4 py-2 text-sm font-medium text-bl-on-action transition-colors hover:brightness-105"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="flex-1 rounded border border-bl-panel bg-bl-panel px-4 py-2 text-sm font-medium text-bl-ink transition-colors hover:bg-bl-surface"
                            >
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Also export a functional component version using Sentry's error boundary
export const SentryErrorBoundary = Sentry.ErrorBoundary;

export default ErrorBoundary;
