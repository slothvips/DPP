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
      className={`markdown-preview w-full h-full min-h-[140px] text-base text-foreground ${!readOnly && !locked ? 'cursor-text' : 'cursor-default'}`}
      style={commonStyle}
    >
      {content ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ node: _node, ...props }) => (
              <p className="mb-2 last:mb-0 break-words" {...props} />
            ),
            h1: ({ node: _node, ...props }) => (
              <h1 className="text-2xl font-bold mb-2 mt-1" {...props} />
            ),
            h2: ({ node: _node, ...props }) => (
              <h2 className="text-xl font-bold mb-2 mt-1" {...props} />
            ),
            h3: ({ node: _node, ...props }) => (
              <h3 className="text-lg font-bold mb-1 mt-1" {...props} />
            ),
            ul: ({ node: _node, ...props }) => (
              <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />
            ),
            ol: ({ node: _node, ...props }) => (
              <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />
            ),
            li: ({ node: _node, ...props }) => <li className="pl-1" {...props} />,
            blockquote: ({ node: _node, ...props }) => (
              <blockquote
                className="border-l-4 border-border pl-3 italic my-2 text-muted-foreground"
                {...props}
              />
            ),
            a: ({ node: _node, ...props }) => (
              <a
                className="bg-blue-500/10 dark:bg-blue-400/20 text-blue-600 dark:text-blue-300 px-1 py-0.5 rounded hover:bg-blue-500/20 dark:hover:bg-blue-400/30 cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();
                  window.open(props.href, '_blank');
                }}
                {...props}
              />
            ),
            code: ({ node: _node, className, children, ...props }) => {
              const match = /language-(\w+)/.exec(className || '');
              const isInline = !match && !String(children).includes('\n');
              return (
                <code
                  className={`${isInline ? 'bg-muted rounded px-1 py-0.5 mx-0.5 text-sm font-mono dark:bg-muted/80' : 'block bg-muted rounded p-2 my-2 text-sm font-mono overflow-x-auto dark:bg-muted/80'}`}
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
