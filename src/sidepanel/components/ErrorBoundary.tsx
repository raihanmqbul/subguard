import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  /** Optional label shown in the error card for context */
  label?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Catches rendering errors in its subtree and displays a "Something went wrong"
 * card with a reload button (Req 28.1, 28.6).
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[SubGuard] Rendering error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center"
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="text-red-400"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Something went wrong{this.props.label ? ` in ${this.props.label}` : ''}.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
