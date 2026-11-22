import { Component, type ReactNode } from "react";

/** Keeps one broken widget from blanking the whole page. */
export class ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error(err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
