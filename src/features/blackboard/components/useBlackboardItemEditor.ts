import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  const [hasExternalConflict, setHasExternalConflict] = useState(false);
  const [minEditHeight, setMinEditHeight] = useState('140px');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const editScrollTopRef = useRef(0);
  const editCaretOffsetRef = useRef<number | undefined>(undefined);
  const editBaselineRef = useRef(item.content);

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
    if (isEditing) {
      if (item.content !== editBaselineRef.current) {
        setHasExternalConflict(true);
      }
      return;
    }
    setContent(item.content);
    editBaselineRef.current = item.content;
    setHasExternalConflict(false);
  }, [isEditing, item.content]);

  useLayoutEffect(() => {
    if (!isEditing || !textareaRef.current) {
      return;
    }

    textareaRef.current.focus({ preventScroll: true });
    const length = textareaRef.current.value.length;
    const caretOffset = Math.min(editCaretOffsetRef.current ?? length, length);
    textareaRef.current.setSelectionRange(caretOffset, caretOffset);
    adjustHeight();
    if (contentRef.current) {
      contentRef.current.scrollTop = editScrollTopRef.current;
    }
  }, [adjustHeight, isEditing]);

  const handleChange = (value: string) => {
    setContent(value);
    adjustHeight();
  };

  const handleActivateEditing = (readOnly?: boolean, caretOffset?: number) => {
    if (readOnly || item.locked) {
      return;
    }

    const contentHeight = containerRef.current?.querySelector('.markdown-preview')?.clientHeight;
    if (contentHeight) {
      setMinEditHeight(`${Math.max(140, contentHeight)}px`);
    }

    editScrollTopRef.current = contentRef.current?.scrollTop ?? 0;
    editCaretOffsetRef.current = caretOffset;
    editBaselineRef.current = item.content;
    setHasExternalConflict(false);
    setIsEditing(true);
  };

  const handleBlur = async () => {
    if (hasExternalConflict) {
      return;
    }
    if (content !== editBaselineRef.current) {
      await onUpdate(item.id, content);
    }
    setIsEditing(false);
  };

  const handleKeepDraft = async () => {
    await onUpdate(item.id, content);
    editBaselineRef.current = content;
    setHasExternalConflict(false);
    setIsEditing(false);
  };

  const handleAcceptExternal = () => {
    setContent(item.content);
    editBaselineRef.current = item.content;
    setHasExternalConflict(false);
    setIsEditing(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.currentTarget.blur();
    }
  };

  return {
    content,
    contentRef,
    containerRef,
    hasExternalConflict,
    isEditing,
    minEditHeight,
    textareaRef,
    transforms,
    handleActivateEditing,
    handleAcceptExternal,
    handleBlur,
    handleChange,
    handleKeepDraft,
    handleKeyDown,
  };
}
