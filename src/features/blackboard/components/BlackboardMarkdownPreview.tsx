import remarkGfm from 'remark-gfm';
import React from 'react';
import ReactMarkdown from 'react-markdown';

interface BlackboardMarkdownPreviewProps {
  content: string;
  commonStyle: React.CSSProperties;
  readOnly?: boolean;
  locked?: boolean;
  onActivateEditing: (caretOffset?: number) => void;
}

const LONG_TEXT_WRAP_CLASS = 'min-w-0 break-words [overflow-wrap:anywhere]';

function isWhitespace(value: string): boolean {
  return /\s/.test(value);
}

function isMarkdownSyntax(value: string): boolean {
  return '#*_`~[]()!>|+-'.includes(value);
}

function mapVisibleOffsetToSource(
  source: string,
  visibleText: string,
  visibleOffset: number
): number {
  let sourceIndex = 0;
  let visibleIndex = 0;

  while (sourceIndex < source.length && visibleIndex < visibleOffset) {
    const sourceChar = source[sourceIndex];
    const visibleChar = visibleText[visibleIndex];

    if (sourceChar === visibleChar || (isWhitespace(sourceChar) && isWhitespace(visibleChar))) {
      sourceIndex += 1;
      visibleIndex += 1;
    } else if (isMarkdownSyntax(sourceChar) || isWhitespace(sourceChar)) {
      sourceIndex += 1;
    } else {
      visibleIndex += 1;
    }
  }

  return sourceIndex;
}

function getCaretOffset(
  event: React.MouseEvent<HTMLDivElement>,
  source: string
): number | undefined {
  const root = event.currentTarget;
  const documentWithCaret = root.ownerDocument as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number
    ) => {
      offsetNode: Node;
      offset: number;
    } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const range = documentWithCaret.caretRangeFromPoint?.(event.clientX, event.clientY);

  if (range && root.contains(range.startContainer)) {
    const prefix = root.ownerDocument.createRange();
    prefix.selectNodeContents(root);
    prefix.setEnd(range.startContainer, range.startOffset);
    return mapVisibleOffsetToSource(source, root.textContent || '', prefix.toString().length);
  }

  const position = documentWithCaret.caretPositionFromPoint?.(event.clientX, event.clientY);
  if (!position || !root.contains(position.offsetNode)) {
    return undefined;
  }

  const prefix = root.ownerDocument.createRange();
  prefix.selectNodeContents(root);
  prefix.setEnd(position.offsetNode, position.offset);
  return mapVisibleOffsetToSource(source, root.textContent || '', prefix.toString().length);
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
      onClick={(event) => onActivateEditing(getCaretOffset(event, content))}
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
            table: ({ node: _node, ...props }) => (
              <div className="my-2 max-w-full overflow-x-auto">
                <table className="min-w-max border-collapse text-sm" {...props} />
              </div>
            ),
            th: ({ node: _node, ...props }) => (
              <th
                className="whitespace-nowrap border border-border/60 bg-muted px-2 py-1 text-left align-top"
                {...props}
              />
            ),
            td: ({ node: _node, ...props }) => (
              <td className="border border-border/60 px-2 py-1 align-top" {...props} />
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
