import { ArrowLeft, FileText, Loader2, RefreshCw } from 'lucide-react';
import remarkGfm from 'remark-gfm';
import 'virtual:uno.css';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import '@unocss/reset/tailwind.css';

const CHANGELOG_URL = 'https://raw.githubusercontent.com/slothvips/DPP/main/CHANGELOG.md';

function ChangelogApp() {
  useTheme();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchChangelog = async (showRefreshing = false) => {
    if (!CHANGELOG_URL) {
      setError('Changelog URL 未配置');
      setLoading(false);
      return;
    }

    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const response = await fetch(CHANGELOG_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      setContent(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchChangelog();
  }, []);

  const goBack = () => {
    if (typeof browser !== 'undefined' && browser.runtime?.getURL) {
      window.open(browser.runtime.getURL('/options.html'), '_self');
    } else {
      window.location.href = '/options.html';
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={goBack} className="gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              返回设置
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchChangelog(true)}
              disabled={loading || refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">加载中...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => fetchChangelog()} variant="outline">
              重试
            </Button>
          </div>
        ) : (
          <article className="prose prose-slate dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        )}
      </main>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ChangelogApp />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
