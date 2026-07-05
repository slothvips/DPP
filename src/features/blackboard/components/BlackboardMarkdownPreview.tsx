import remarkGfm from 'remark-gfm';
import React from 'react';
import ReactMarkdown from 'react-markdown';

interface BlackboardMarkdownPreviewProps {
  content: string;
  commonStyle: React.CSSProperties;
  readOnly?: boolean;
  locked?: boolean;
  onActivateEditing: () => void;
}

const LONG_TEXT_WRAP_CLASS = 'min-w-0 break-words [overflow-wrap:anywhere]';

export function BlackboardMarkdownPreview({
  content,
  commonStyle,
  readOnly,
  locked,
  onActivateEditing,
}: BlackboardMarkdownPreviewProps) {
  return (
    <div
      onClick={onActivateEditing}
      className={`markdown-preview h-full min-h-[140px] w-full text-base text-foreground ${LONG_TEXT_WRAP_CLASS} ${!readOnly && !locked ? 'cursor-text' : 'cursor-default'}`}
      style={commonStyle}
    >
      {content ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ node: _node, ...props }) => (
              <p className={`mb-2 last:mb-0 ${LONG_TEXT_WRAP_CLASS}`} {...props} />
            ),
            h1: ({ node: _node, ...props }) => (
              <h1 className={`mb-2 mt-1 text-2xl font-bold ${LONG_TEXT_WRAP_CLASS}`} {...props} />
            ),
            h2: ({ node: _node, ...props }) => (
              <h2 className={`mb-2 mt-1 text-xl font-bold ${LONG_TEXT_WRAP_CLASS}`} {...props} />
            ),
            h3: ({ node: _node, ...props }) => (
              <h3 className={`mb-1 mt-1 text-lg font-bold ${LONG_TEXT_WRAP_CLASS}`} {...props} />
            ),
            ul: ({ node: _node, ...props }) => (
              <ul className={`mb-2 list-disc space-y-1 pl-5 ${LONG_TEXT_WRAP_CLASS}`} {...props} />
            ),
            ol: ({ node: _node, ...props }) => (
              <ol
                className={`mb-2 list-decimal space-y-1 pl-5 ${LONG_TEXT_WRAP_CLASS}`}
                {...props}
              />
            ),
            li: ({ node: _node, ...props }) => (
              <li className={`pl-1 ${LONG_TEXT_WRAP_CLASS}`} {...props} />
            ),
            blockquote: ({ node: _node, ...props }) => (
              <blockquote
                className={`my-2 border-l-4 border-border pl-3 italic text-muted-foreground ${LONG_TEXT_WRAP_CLASS}`}
                {...props}
              />
            ),
            a: ({ node: _node, ...props }) => (
              <a
                className={`cursor-pointer rounded bg-blue-500/10 px-1 py-0.5 text-blue-600 hover:bg-blue-500/20 dark:bg-blue-400/20 dark:text-blue-300 dark:hover:bg-blue-400/30 ${LONG_TEXT_WRAP_CLASS}`}
                onClick={(event) => {
                  event.stopPropagation();
                  window.open(props.href, '_blank');
                }}
                {...props}
              />
            ),
            pre: ({ node: _node, ...props }) => (
              <pre className={`my-2 whitespace-pre-wrap ${LONG_TEXT_WRAP_CLASS}`} {...props} />
            ),
            code: ({ node: _node, className, children, ...props }) => {
              const match = /language-(\w+)/.exec(className || '');
              const isInline = !match && !String(children).includes('\n');
              return (
                <code
                  className={
                    isInline
                      ? `mx-0.5 rounded bg-muted px-1 py-0.5 font-mono text-sm dark:bg-muted/80 ${LONG_TEXT_WRAP_CLASS}`
                      : `block rounded bg-muted p-2 font-mono text-sm whitespace-pre-wrap dark:bg-muted/80 ${LONG_TEXT_WRAP_CLASS}`
                  }
                  {...props}
                >
                  {children}
                </code>
              );
            },
            input: ({ node: _node, ...props }) => {
              if (props.type === 'checkbox') {
                return (
                  <input
                    type="checkbox"
                    className="mr-2 cursor-pointer accent-primary"
                    checked={props.checked}
                    readOnly
                    {...props}
                  />
                );
              }
              return <input {...props} />;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      ) : (
        <span className="text-muted-foreground italic">写点什么...</span>
      )}
    </div>
  );
}
