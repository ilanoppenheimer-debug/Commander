import React, { useState, useEffect, useRef } from 'react';
import { Timer, Pause, Play, RotateCcw, X } from 'lucide-react';
import { playTacticalAlarm, playPreAlert } from '../services/audioService';

const CORNER_KEY = 'timerCorner';
const MARGIN = 16;
const TIMER_SIZE = 56;
const BOTTOM_NAV_HEIGHT = 80;

function getCornerPos(corner) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  switch (corner) {
    case 'tl': return { x: MARGIN, y: MARGIN + 60 }; // clear header
    case 'tr': return { x: w - TIMER_SIZE - MARGIN, y: MARGIN + 60 };
    case 'bl': return { x: MARGIN, y: h - TIMER_SIZE - BOTTOM_NAV_HEIGHT - MARGIN };
    case 'br': default:
      return { x: w - TIMER_SIZE - MARGIN, y: h - TIMER_SIZE - BOTTOM_NAV_HEIGHT - MARGIN };
  }
}

function snapToCorner(x, y) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isRight = x + TIMER_SIZE / 2 > w / 2;
  const isBottom = y + TIMER_SIZE / 2 > h / 2;
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

  const applyPos = (x, y, animated = false) => {
    if (!timerRef.current) return;
    timerRef.current.style.transition = animated ? 'transform 0.2s ease-out' : 'none';
    timerRef.current.style.transform = `translate(${x}px, ${y}px)`;
    posRef.current = { x, y };
  };

  // Load saved corner and reposition on resize
  useEffect(() => {
    const place = () => {
      const savedCorner = localStorage.getItem(CORNER_KEY) || 'br';
      const pos = getCornerPos(savedCorner);
      applyPos(pos.x, pos.y, false);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, []);

  // Timer tick
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setSeconds(s => {
        if (mode === 'timer') {
          if (s === 11) playPreAlert();
          if (s <= 1) { clearInterval(interval); setIsActive(false); playTacticalAlarm(); return 0; }
          return s - 1;
        }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, mode]);

  // Listen for auto-trigger events from session
  useEffect(() => {
    let autoCloseTimer;
    const handler = (e) => {
      const { seconds: restSecs } = e.detail || {};
      if (!restSecs) return;
      setMode('timer');
      setInitialTimerSeconds(restSecs);
      setSeconds(restSecs);
      setIsActive(true);
      setIsExpanded(true);
      clearTimeout(autoCloseTimer);
      autoCloseTimer = setTimeout(() => setIsExpanded(false), 3000);
    };
    window.addEventListener('iron-cmdr:start-rest-timer', handler);
    return () => { window.removeEventListener('iron-cmdr:start-rest-timer', handler); clearTimeout(autoCloseTimer); };
  }, []);

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const setTimerPreset = (secs) => {
    setMode('timer');
    setInitialTimerSeconds(secs);
    setSeconds(secs);
    setIsActive(true);
    setIsExpanded(false);
  };

  const handlePointerDown = (e) => {
    draggingRef.current = false;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    startPosRef.current = { x: cx - posRef.current.x, y: cy - posRef.current.y };
    if (timerRef.current) timerRef.current.style.transition = 'none';
  };

  const handlePointerMove = (e) => {
    if (startPosRef.current.x === null) return;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    let nx = cx - startPosRef.current.x;
    let ny = cy - startPosRef.current.y;
    if (Math.abs(nx - posRef.current.x) > 5 || Math.abs(ny - posRef.current.y) > 5) {
      draggingRef.current = true;
    }
    nx = Math.max(MARGIN, Math.min(nx, window.innerWidth - TIMER_SIZE - MARGIN));
    ny = Math.max(MARGIN, Math.min(ny, window.innerHeight - TIMER_SIZE - MARGIN));
    applyPos(nx, ny, false);
  };

  const handlePointerUp = () => {
    if (draggingRef.current) {
      const corner = snapToCorner(posRef.current.x, posRef.current.y);
      const pos = getCornerPos(corner);
      applyPos(pos.x, pos.y, true);
      localStorage.setItem(CORNER_KEY, corner);
    }
    startPosRef.current = { x: null, y: null };
  };

  const handleClick = () => {
    if (!draggingRef.current) setIsExpanded(v => !v);
    draggingRef.current = false;
  };

  const alertRed = isActive && mode === 'timer' && seconds <= 10;

  return (
    <>
      {/* Expanded sheet modal */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-[99] bg-black/60 backdrop-blur-sm flex items-end justify-center p-4 animate-fade-in"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl mb-20 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-700">
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                {mode === 'stopwatch' ? 'Cronómetro' : 'Temporizador'}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const next = mode === 'stopwatch' ? 'timer' : 'stopwatch';
                    setMode(next);
                    setIsActive(false);
                    setSeconds(next === 'timer' ? initialTimerSeconds : 0);
                  }}
                  className="text-xs bg-slate-800 px-3 py-1.5 rounded text-slate-300 hover:text-white border border-slate-700 transition"
                >
                  Cambiar
                </button>
                <button onClick={() => setIsExpanded(false)} className="p-1.5 text-slate-400 hover:text-white transition">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 my-4">
              <button
                onClick={() => {
                  setSeconds(prev => Math.max(0, prev - 15));
                  if (navigator.vibrate) navigator.vibrate(30);
                }}
                className="w-12 h-12 rounded-full bg-slate-800 border border-accent-500/30 text-accent-400 font-bold text-sm flex items-center justify-center hover:bg-slate-700 active:scale-95 transition"
                aria-label="Restar 15 segundos"
              >
                −15s
              </button>
              <div className={`text-6xl font-black font-mono tabular-nums ${alertRed ? 'text-red-500' : 'text-white'}`}>
                {formatTime(seconds)}
              </div>
              <button
                onClick={() => {
                  setSeconds(prev => prev + 15);
                  if (navigator.vibrate) navigator.vibrate(30);
                }}
                className="w-12 h-12 rounded-full bg-slate-800 border border-accent-500/30 text-accent-400 font-bold text-sm flex items-center justify-center hover:bg-slate-700 active:scale-95 transition"
                aria-label="Sumar 15 segundos"
              >
                +15s
              </button>
            </div>

            <div className="flex justify-center gap-3 mb-4">
              <button
                onClick={() => setIsActive(v => !v)}
                className={`p-4 rounded-full transition ${isActive ? 'bg-accent-600/20 text-accent-500 border-2 border-accent-500/40' : 'bg-accent-600 text-black hover:bg-accent-500'}`}
                aria-label={isActive ? 'Pausar' : 'Iniciar'}
              >
                {isActive ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
              </button>
              <button
                onClick={() => { setIsActive(false); setSeconds(mode === 'timer' ? initialTimerSeconds : 0); }}
                className="p-4 rounded-full bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition"
                aria-label="Reiniciar"
              >
                <RotateCcw size={24} />
              </button>
            </div>

            {mode === 'timer' && (
              <>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 text-center">Presets</div>
                <div className="grid grid-cols-3 gap-2">
                  {[30, 60, 90, 120, 180, 240].map(secs => (
                    <button
                      key={secs}
                      onClick={() => setTimerPreset(secs)}
                      className="px-2 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300 border border-slate-700 hover:border-accent-500 transition active:scale-95"
                    >
                      {Math.floor(secs / 60) > 0 ? `${Math.floor(secs / 60)}m${secs % 60 > 0 ? secs % 60 : ''}` : `${secs}s`}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating button */}
      <div
        ref={timerRef}
        className="fixed top-0 left-0 z-[98]"
        style={{ touchAction: 'none' }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onClick={handleClick}
      >
        <div
          className={`w-14 h-14 rounded-full bg-slate-900 border-2 flex flex-col items-center justify-center shadow-xl cursor-grab active:cursor-grabbing select-none transition-shadow ${
            alertRed
              ? 'border-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.6)]'
              : isActive
              ? 'border-accent-500 shadow-[0_0_15px_rgb(var(--accent-500)/0.3)]'
              : 'border-slate-600'
          }`}
        >
          <Timer
            size={16}
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
    </>
  );
};

export default AdvancedTimer;
