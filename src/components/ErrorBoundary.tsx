import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  sectionName?: string;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary - ${this.props.sectionName || 'General'}] Caught error:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public handleReloadPage = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      const section = this.props.sectionName || 'هذا القسم';
      const title = this.props.fallbackTitle || `حدث خطأ غير متوقع في ${section}`;
      const message =
        this.props.fallbackMessage ||
        'تعذر عرض محتوى هذا القسم نتيجة خطأ برمجي غير متوقع. باقي أقسام الموقع تعمل بشكل طبيعي، ويمكنك المحاولة مرة أخرى.';

      return (
        <div
          id={`error-boundary-${section.replace(/\s+/g, '-').toLowerCase()}`}
          className="my-4 p-5 sm:p-6 bg-white border border-rose-200 rounded-3xl shadow-sm text-center max-w-xl mx-auto"
          dir="rtl"
        >
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <h3 className="text-base sm:text-lg font-black text-slate-900 mb-2">{title}</h3>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">{message}</p>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <button
              id={`btn-reset-${section.replace(/\s+/g, '-').toLowerCase()}`}
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة تحميل القسم</span>
            </button>

            <button
              id={`btn-reload-page-${section.replace(/\s+/g, '-').toLowerCase()}`}
              onClick={this.handleReloadPage}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs sm:text-sm font-bold transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>تحديث الصفحة كاملة</span>
            </button>
          </div>

          {/* Collapsible details for troubleshooting */}
          {this.state.error && (
            <details className="mt-6 text-right border-t border-slate-100 pt-3">
              <summary className="text-[11px] font-bold text-slate-400 cursor-pointer hover:text-slate-600 select-none">
                تفاصيل الخطأ الفنية (للمطورين والدعم)
              </summary>
              <pre className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-rose-700 font-mono overflow-x-auto text-left dir-ltr">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
