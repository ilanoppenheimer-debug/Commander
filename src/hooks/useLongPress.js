import { useRef, useCallback } from 'react';

export const useLongPress = (callback, ms = 500) => {
  const timerRef = useRef(null);
  const triggeredRef = useRef(false);

  const start = useCallback((e) => {
    // Prevent text selection on long press
    e.preventDefault();
    triggeredRef.current = false;
    timerRef.current = setTimeout(() => {
      triggeredRef.current = true;
      callback();
    }, ms);
  }, [callback, ms]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    wasTriggered: () => triggeredRef.current,
  };
};
