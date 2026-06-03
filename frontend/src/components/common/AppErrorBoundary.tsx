import * as React from "react";
import { ErrorState } from "./ErrorState";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error inside ErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Attempt standard page recovery
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-8 bg-canvas">
          <ErrorState
            title="Application Error"
            message={this.state.error?.message || "An unexpected rendering error occurred."}
            onRetry={this.handleReset}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
