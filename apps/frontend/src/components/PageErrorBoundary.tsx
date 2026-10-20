import { Component, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { Button } from './ui';
export class PageErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="state" role="alert">
          <CircleAlert size={30} />
          <h1>Не вдалося завантажити сторінку</h1>
          <p>Оновіть сторінку й повторіть спробу.</p>
          <Button onClick={() => window.location.reload()}>
            Оновити сторінку
          </Button>
          <a href="/">До магазину</a>
        </main>
      );
    return this.props.children;
  }
}
