import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误信息
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // 如果有自定义的fallback UI，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认的错误UI
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fa-solid fa-exclamation-triangle text-2xl text-red-600 dark:text-red-400"></i>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              出了点问题
            </h1>
            
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              抱歉，应用程序遇到了一个意外错误。我们已经记录了这个问题。
            </p>

            {/* 开发环境下显示错误详情 */}
            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-left">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  错误详情 (仅开发环境显示):
                </h3>
                <pre className="text-xs text-red-600 dark:text-red-400 overflow-auto max-h-32">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                onClick={this.handleReset}
                variant="outline"
                className="flex-1"
              >
                <i className="fa-solid fa-refresh mr-2"></i>
                重试
              </Button>
              
              <Button 
                onClick={this.handleReload}
                className="flex-1"
              >
                <i className="fa-solid fa-home mr-2"></i>
                重新加载页面
              </Button>
            </div>

            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              如果问题持续存在，请联系技术支持。
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// 创建一个HOC来简化使用
export function withErrorBoundary<T extends object>(
  Component: React.ComponentType<T>,
  fallback?: ReactNode
) {
  const WrappedComponent = (props: T) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}