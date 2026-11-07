import { Component, type ReactNode } from 'react';
import { Button } from './ui/Button';

const reload = () => window.location.reload();

export function AppErrorScreen({ onReload = reload }: { onReload?: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6 text-text">
      <div role="alert" className="max-w-md space-y-4 text-center">
        <h1 className="text-title1">Something Went Wrong</h1>
        <Button onClick={onReload}>Reload</Button>
      </div>
    </main>
  );
}

export class AppErrorBoundary extends Component<
  { children: ReactNode; onReload?: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <AppErrorScreen onReload={this.props.onReload} />
    ) : (
      this.props.children
    );
  }
}
