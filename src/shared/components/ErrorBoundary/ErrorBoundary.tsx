// error boundary to catch render crashes per route

import React from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // keep it simple, log to console for now
    // in real app we'd send this to logging
    // eslint-disable-next-line no-console
    console.error('route crashed', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <h2 className="error-boundary__title">Something went wrong.</h2>
          <p className="error-boundary__message">Try refreshing the page.</p>
          <button
            type="button"
            className="error-boundary__button"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
