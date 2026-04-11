import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BlackboardItem } from '../types';

interface UseBlackboardItemEditorOptions {
  item: BlackboardItem;
  isFocused?: boolean;
  onFocusHandled?: () => void;
  onResize?: () => void;
  onUpdate: (id: string, content: string) => Promise<void>;
}

export function useBlackboardItemEditor({
  item,
  isFocused,
  onFocusHandled,
  onResize,
  onUpdate,
}: UseBlackboardItemEditorOptions) {
  const [content, setContent] = useState(item.content);
  const [isEditing, setIsEditing] = useState(false);
  const [minEditHeight, setMinEditHeight] = useState('140px');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    setIsEditing(true);
    const timer = setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      onFocusHandled?.();
    }, 100);

    return () => clearTimeout(timer);
  }, [isFocused, onFocusHandled]);

  const transforms = useMemo(() => ({ rotation: 0, xOffset: 0, yOffset: 0 }), []);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const prevHeight = textarea.style.height;
    textarea.style.height = 'auto';
    const nextHeight = `${textarea.scrollHeight}px`;
    textarea.style.height = nextHeight;

    if (prevHeight !== nextHeight) {
      onResize?.();
    }
  }, [onResize]);

  useEffect(() => {
    setContent(item.content);
  }, [item.content]);

  useEffect(() => {
    if (!isEditing || !textareaRef.current) {
      return;
    }

    textareaRef.current.focus();
    const length = textareaRef.current.value.length;
    textareaRef.current.setSelectionRange(length, length);
    adjustHeight();
  }, [adjustHeight, isEditing]);

  const handleChange = (value: string) => {
    setContent(value);
    adjustHeight();
  };

  const handleActivateEditing = (readOnly?: boolean) => {
    if (readOnly || item.locked) {
      return;
    }

    const contentHeight = containerRef.current?.querySelector('.markdown-preview')?.clientHeight;
    if (contentHeight) {
      setMinEditHeight(`${Math.max(140, contentHeight)}px`);
    }

    setIsEditing(true);
  };

  const handleBlur = async () => {
    setIsEditing(false);
    if (content !== item.content) {
      await onUpdate(item.id, content);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.currentTarget.blur();
    }
  };

  return {
    content,
    containerRef,
    isEditing,
    minEditHeight,
    textareaRef,
    transforms,
    handleActivateEditing,
    handleBlur,
    handleChange,
    handleKeyDown,
  };
}
