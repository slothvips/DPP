import React from 'react';
import { logger } from '@/utils/logger';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-destructive">
          <h2 className="font-bold">Something went wrong.</h2>
          <pre className="mt-2 text-xs overflow-auto bg-muted p-2 rounded text-muted-foreground">
            {this.state.error?.toString()}
          </pre>
          <button
            type="button"
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
