import { FileText, Github } from 'lucide-react';
import { browser } from 'wxt/browser';

export function FooterLinks() {
  return (
    <div className="flex flex-col items-center justify-center pt-8 pb-4 opacity-50 hover:opacity-100 transition-opacity gap-2">
      <a
        href="https://github.com/slothvips/DPP"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <Github className="w-3 h-3" />
        Open Source on GitHub
      </a>
      <a
        href={
          (browser.runtime?.getURL as (path: string) => string)?.('/changelog.html') ||
          '/changelog.html'
        }
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <FileText className="w-3 h-3" />
        更新日志
      </a>
      <br />
      <a
        href="javascript:;"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
      >
        powered by vibe coding.
      </a>
    </div>
  );
}
