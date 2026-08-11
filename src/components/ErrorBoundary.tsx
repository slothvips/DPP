import React from 'react';
import { cn } from '@/utils/cn';
import { logger } from '@/utils/logger';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /**
   * 模块名称。设置后启用模块级隔离：错误只替换本区域，
   * 不影响侧栏壳层及其他模块。
   */
  moduleName?: string;
  /** 错误态容器额外 class（例如内容区需要 h-full） */
  className?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  resetKey: number;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const scope = this.props.moduleName ? `[${this.props.moduleName}] ` : '';
    logger.error(`${scope}Uncaught error:`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      resetKey: prev.resetKey + 1,
    }));
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { moduleName, children, className } = this.props;
    const isolated = Boolean(moduleName);

    if (this.state.hasError) {
      const title = isolated ? `${moduleName}出现错误` : '出现错误';
      const description = isolated
        ? '该模块暂时无法显示，其他功能可继续使用。可尝试重试，或切换到其他模块。'
        : '应用遇到未处理的错误。可尝试重新加载页面。';

      return (
        <div
          className={cn(
            isolated
              ? 'flex min-h-0 flex-col items-center justify-center gap-3 overflow-auto p-6 text-center'
              : 'flex h-full min-h-0 flex-col overflow-auto p-4',
            className
          )}
          data-testid={isolated ? 'module-error-boundary' : 'app-error-boundary'}
          role="alert"
        >
          <h2 className="text-sm font-semibold text-destructive">{title}</h2>
          <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
          <pre className="mt-1 max-h-32 w-full max-w-md overflow-auto rounded-lg bg-muted p-2 text-left text-xs text-muted-foreground">
            {this.state.error?.toString()}
          </pre>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {isolated ? (
              <>
                <button
                  type="button"
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  onClick={this.handleRetry}
                  data-testid="module-error-retry"
                >
                  重试
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground"
                  onClick={this.handleReload}
                  data-testid="module-error-reload"
                >
                  重新加载应用
                </button>
              </>
            ) : (
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                onClick={this.handleReload}
                data-testid="app-error-reload"
              >
                重新加载
              </button>
            )}
          </div>
        </div>
      );
    }

    // 模块级：Fragment + key，重试时重挂载且不影响布局
    // 顶层级：保留 h-full 容器，兼容各入口页的高度链路
    if (isolated) {
      return <React.Fragment key={this.state.resetKey}>{children}</React.Fragment>;
    }

    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden" key={this.state.resetKey}>
        {children}
      </div>
    );
  }
}
