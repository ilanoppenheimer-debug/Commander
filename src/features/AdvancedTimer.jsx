import React, { useState, useEffect, useRef } from 'react';
import { Timer, Pause, Play, RotateCcw } from 'lucide-react';
import { playTacticalAlarm } from '../services/audioService';

const AdvancedTimer = () => {    const [mode, setMode] = useState('stopwatch'); 
    const [seconds, setSeconds] = useState(0);
    const [initialTimerSeconds, setInitialTimerSeconds] = useState(60); 
    const [isActive, setIsActive] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const timerRef = useRef(null);
    const draggingRef = useRef(false);
    const startPosRef = useRef({ x: null, y: null });
    const posRef = useRef({ 
        x: typeof window !== 'undefined' ? window.innerWidth - 80 : 300, 
        y: typeof window !== 'undefined' ? window.innerHeight - 150 : 600 
    });

    useEffect(() => {
      let interval = null;
      if (isActive) {
        interval = setInterval(() => {
          setSeconds(s => {
            if (mode === 'timer') {
              if (s <= 1) { clearInterval(interval); setIsActive(false); playTacticalAlarm(); return 0; }
              return s - 1;
            } else { return s + 1; }
          });
        }, 1000);
      } else if (!isActive && seconds !== 0 && mode === 'stopwatch') { clearInterval(interval); }
      return () => clearInterval(interval);
    }, [isActive, mode]);

    useEffect(() => {
        if (timerRef.current) timerRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
    }, []);

    const formatTime = (totalSeconds) => {
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const setTimerPreset = (secs) => { setMode('timer'); setInitialTimerSeconds(secs); setSeconds(secs); setIsActive(true); setIsExpanded(false); };
    
    const handlePointerDown = (e) => {
        draggingRef.current = false;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        startPosRef.current = { x: clientX - posRef.current.x, y: clientY - posRef.current.y };
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

        newX = Math.max(0, Math.min(newX, window.innerWidth - 60));
        newY = Math.max(0, Math.min(newY, window.innerHeight - 60));

        posRef.current = { x: newX, y: newY };
        if (timerRef.current) timerRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
    };

    const handlePointerUp = () => { startPosRef.current = { x: null, y: null }; };

    const toggleExpand = (e) => {
        if (!draggingRef.current) setIsExpanded(!isExpanded);
    };

    return (
      <div ref={timerRef} className="fixed top-0 left-0 z-[100] flex flex-col items-center" style={{ touchAction: 'none' }}>
        {isExpanded && (
           <div className="absolute bottom-16 -right-16 sm:right-0 bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl shadow-black/80 mb-2 w-52 animate-fade-in-up">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-700">
                 <span className="text-xs font-bold text-slate-400 uppercase">{mode === 'stopwatch' ? 'Cronómetro' : 'Temporizador'}</span>
                 <button onClick={() => { setMode(mode === 'stopwatch' ? 'timer' : 'stopwatch'); setIsActive(false); setSeconds(mode === 'stopwatch' ? initialTimerSeconds : 0); }} className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-300 hover:text-white border border-slate-700">Cambiar</button>
              </div>
              <div className="flex justify-center gap-4 mb-3">
                  <button onClick={() => setIsActive(!isActive)} className={`p-3 rounded-full ${isActive ? 'bg-amber-600/20 text-amber-500' : 'bg-slate-800 text-slate-300 hover:text-white'}`}>
                      {isActive ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor"/>}
                  </button>
                  <button onClick={() => { setIsActive(false); setSeconds(mode === 'timer' ? initialTimerSeconds : 0); }} className="p-3 rounded-full bg-slate-800 text-slate-300 hover:text-white">
                      <RotateCcw size={20} />
                  </button>
              </div>
              {mode === 'timer' && (
                 <div className="grid grid-cols-3 gap-2">
                    {[30, 60, 90, 120, 180, 240].map(secs => (
                       <button key={secs} onClick={() => setTimerPreset(secs)} className="px-1 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-bold text-slate-300 border border-slate-700 hover:border-amber-500 transition">
                          {Math.floor(secs/60) > 0 ? `${Math.floor(secs/60)}m${secs%60 > 0 ? secs%60 : ''}` : `${secs}s`}
                       </button>
                    ))}
                 </div>
              )}
           </div>
        )}
        <div 
            onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp} onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp} onClick={toggleExpand}
            className={`w-14 h-14 rounded-full bg-slate-800 border-2 ${isActive && mode === 'timer' && seconds <= 10 ? 'border-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]' : isActive ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border-slate-600'} flex flex-col items-center justify-center shadow-xl cursor-grab active:cursor-grabbing backdrop-blur-md select-none`}
        >
            <Timer size={18} className={isActive && mode === 'timer' && seconds <= 10 ? 'text-red-500' : isActive ? 'text-amber-500' : 'text-slate-400'} style={{ pointerEvents: 'none' }} />
            <span className={`text-[10px] font-bold font-mono leading-tight mt-0.5 ${isActive && mode === 'timer' && seconds <= 10 ? 'text-red-500' : 'text-white'}`} style={{ pointerEvents: 'none' }}>{formatTime(seconds)}</span>
        </div>
      </div>
    );
};
export default AdvancedTimer;
