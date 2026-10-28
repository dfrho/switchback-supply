import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/**
 * Safety net: if any part of the storefront throws while rendering, show a
 * friendly message with a reload button instead of a blank page.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Storefront crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="setup" role="alert">
        <h1>Trail washed out</h1>
        <p>Something went wrong while loading the store. Reloading usually fixes it.</p>
        <p className="muted small mono">{this.state.error.message}</p>
        <button className="btn btn--primary" onClick={() => window.location.reload()}>
          Reload the page
        </button>
      </main>
    );
  }
}
