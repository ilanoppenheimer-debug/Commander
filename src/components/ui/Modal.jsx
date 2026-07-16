import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Global counter so nested modals don't unlock scroll prematurely
let openCount = 0;
let savedOverflow = '';

function lockScroll() {
  if (openCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  openCount++;
}

function unlockScroll() {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) {
    document.body.style.overflow = savedOverflow;
  }
}

const SIZE_CLASSES = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-lg',
  xl:   'max-w-xl',
  '2xl':'max-w-2xl',
  full: 'max-w-lg sm:max-w-2xl',
};

export default function Modal({
  isOpen,
  onClose,
  children,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  align = 'bottom', // 'bottom' = sheet from bottom on mobile, 'center' = always centered
}) {
  const contentRef = useRef(null);

  // Latest onClose/closeOnEscape without making the mount effect depend on them —
  // callers pass inline arrow functions, which get a new reference on every parent
  // render. If the effect depended on those, any periodic re-render of the parent
  // (e.g. a 1s timer) would re-run it: re-lock scroll and re-fire the autofocus
  // setTimeout, stealing focus from whatever the user is typing in.
  const onCloseRef = useRef(onClose);
  const closeOnEscapeRef = useRef(closeOnEscape);
  onCloseRef.current = onClose;
  closeOnEscapeRef.current = closeOnEscape;

  useEffect(() => {
    if (!isOpen) return;

    lockScroll();

    const onKey = (e) => {
      if (closeOnEscapeRef.current && e.key === 'Escape') onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);

    // Focus first focusable element — but don't steal focus if something inside the
    // modal already has it (e.g. an input with autoFocus that grabbed it on mount).
    const t = setTimeout(() => {
      const root = contentRef.current;
      if (root && root.contains(document.activeElement)) return;
      const el = root?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      el?.focus();
    }, 50);

    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
      unlockScroll();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  return createPortal(
    <div
      className={`fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-md flex justify-center animate-fade-in ${align === 'center' ? 'items-center p-4' : 'items-end sm:items-center p-0 sm:p-4'}`}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={contentRef}
        className={`w-full ${sizeClass} animate-fade-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
