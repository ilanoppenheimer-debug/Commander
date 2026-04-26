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
}) {
  const contentRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    lockScroll();

    const onKey = (e) => {
      if (closeOnEscape && e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);

    // Focus first focusable element
    const t = setTimeout(() => {
      const el = contentRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      el?.focus();
    }, 50);

    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
      unlockScroll();
    };
  }, [isOpen, onClose, closeOnEscape]);

  if (!isOpen) return null;

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
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
