import React, { useState, useEffect, useRef } from 'react';
import { Timer, Pause, Play, RotateCcw } from 'lucide-react';
import { playTacticalAlarm } from '../services/audioService';

const MARGIN = 16;
const CORNER_KEY = 'timerCorner';

function getCornerPos(corner) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const sz = 56;
  switch (corner) {
    case 'tl': return { x: MARGIN, y: MARGIN };
    case 'tr': return { x: w - sz - MARGIN, y: MARGIN };
    case 'bl': return { x: MARGIN, y: h - sz - MARGIN };
    case 'br': default: return { x: w - sz - MARGIN, y: h - sz - MARGIN };
  }
}

function snapCorner(x, y) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isRight = x > w / 2;
  const isBottom = y > h / 2;
  if (!isRight && !isBottom) return 'tl';
  if (isRight && !isBottom) return 'tr';
  if (!isRight && isBottom) return 'bl';
  return 'br';
}

const AdvancedTimer = () => {
  const [mode, setMode] = useState('stopwatch');
  const [seconds, setSeconds] = useState(0);
  const [initialTimerSeconds, setInitialTimerSeconds] = useState(60);
  const [isActive, setIsActive] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const timerRef = useRef(null);
  const draggingRef = useRef(false);
  const startPosRef = useRef({ x: null, y: null });
  const posRef = useRef({ x: 0, y: 0 });

  // Apply position with optional transition
  const applyPos = (x, y, animated = false) => {
    if (!timerRef.current) return;
    timerRef.current.style.transition = animated ? 'transform 0.2s ease-out' : 'none';
    timerRef.current.style.transform = `translate(${x}px, ${y}px)`;
    posRef.current = { x, y };
  };

  // Load saved corner on mount
  useEffect(() => {
    const savedCorner = localStorage.getItem(CORNER_KEY) || 'br';
    const pos = getCornerPos(savedCorner);
    applyPos(pos.x, pos.y, false);
  }, []);

  // Timer tick
  useEffect(() => {
    let interval = null;
    if (isActive) {
      interval = setInterval(() => {
        setSeconds(s => {
          if (mode === 'timer') {
            if (s <= 1) { clearInterval(interval); setIsActive(false); playTacticalAlarm(); return 0; }
            return s - 1;
          }
          return s + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, mode]);

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const setTimerPreset = (secs) => {
    setMode('timer');
    setInitialTimerSeconds(secs);
    setSeconds(secs);
    setIsActive(true);
    setIsExpanded(false);
  };

  const handlePointerDown = (e) => {
    draggingRef.current = false;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startPosRef.current = { x: clientX - posRef.current.x, y: clientY - posRef.current.y };
    if (timerRef.current) timerRef.current.style.transition = 'none';
  };

  const handlePointerMove = (e) => {
    if (startPosRef.current.x === null) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    let newX = clientX - startPosRef.current.x;
    let newY = clientY - startPosRef.current.y;

    if (Math.abs(newX - posRef.current.x) > 5 || Math.abs(newY - posRef.current.y) > 5) {
      draggingRef.current = true;
    }

    newX = Math.max(0, Math.min(newX, window.innerWidth - 56));
    newY = Math.max(0, Math.min(newY, window.innerHeight - 56));
    applyPos(newX, newY, false);
  };

  const handlePointerUp = () => {
    if (draggingRef.current) {
      const corner = snapCorner(posRef.current.x, posRef.current.y);
      const pos = getCornerPos(corner);
      applyPos(pos.x, pos.y, true);
      localStorage.setItem(CORNER_KEY, corner);
    }
    startPosRef.current = { x: null, y: null };
  };

  const toggleExpand = () => {
    if (!draggingRef.current) setIsExpanded(v => !v);
    draggingRef.current = false;
  };

  const alertRed = isActive && mode === 'timer' && seconds <= 10;

  return (
    <div
      ref={timerRef}
      className="fixed top-0 left-0 z-[100] flex flex-col items-center"
      style={{ touchAction: 'none' }}
    >
      {isExpanded && (
        <div className="absolute bottom-16 -right-16 sm:right-0 bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl shadow-black/80 w-52 animate-fade-in-up">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-700">
            <span className="text-xs font-bold text-slate-400 uppercase">
              {mode === 'stopwatch' ? 'Cronómetro' : 'Temporizador'}
            </span>
            <button
              onClick={() => {
                const next = mode === 'stopwatch' ? 'timer' : 'stopwatch';
                setMode(next);
                setIsActive(false);
                setSeconds(next === 'timer' ? initialTimerSeconds : 0);
              }}
              className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-300 hover:text-white border border-slate-700"
            >
              Cambiar
            </button>
          </div>
          <div className="flex justify-center gap-4 mb-3">
            <button
              onClick={() => setIsActive(v => !v)}
              className={`p-3 rounded-full ${isActive ? 'bg-accent-600/20 text-accent-500' : 'bg-slate-800 text-slate-300 hover:text-white'}`}
            >
              {isActive ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button
              onClick={() => { setIsActive(false); setSeconds(mode === 'timer' ? initialTimerSeconds : 0); }}
              className="p-3 rounded-full bg-slate-800 text-slate-300 hover:text-white"
            >
              <RotateCcw size={20} />
            </button>
          </div>
          {mode === 'timer' && (
            <div className="grid grid-cols-3 gap-2">
              {[30, 60, 90, 120, 180, 240].map(secs => (
                <button
                  key={secs}
                  onClick={() => setTimerPreset(secs)}
                  className="px-1 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-bold text-slate-300 border border-slate-700 hover:border-accent-500 transition"
                >
                  {Math.floor(secs / 60) > 0 ? `${Math.floor(secs / 60)}m${secs % 60 > 0 ? secs % 60 : ''}` : `${secs}s`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onClick={toggleExpand}
        className={`w-14 h-14 rounded-full bg-slate-800 border-2 ${
          alertRed
            ? 'border-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]'
            : isActive
            ? 'border-accent-500 shadow-[0_0_15px_rgb(var(--accent-500)/0.3)]'
            : 'border-slate-600'
        } flex flex-col items-center justify-center shadow-xl cursor-grab active:cursor-grabbing backdrop-blur-md select-none`}
      >
        <Timer
          size={18}
          className={alertRed ? 'text-red-500' : isActive ? 'text-accent-500' : 'text-slate-400'}
          style={{ pointerEvents: 'none' }}
        />
        <span
          className={`text-[10px] font-bold font-mono leading-tight mt-0.5 ${alertRed ? 'text-red-500' : 'text-white'}`}
          style={{ pointerEvents: 'none' }}
        >
          {formatTime(seconds)}
        </span>
      </div>
    </div>
  );
};

export default AdvancedTimer;
