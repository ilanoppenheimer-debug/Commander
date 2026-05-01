import { useState } from 'react';

const Btn = ({ onClick, children, accent, className = '' }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-center rounded-xl font-bold transition-colors active:scale-95 select-none ${
      accent === 'orange'
        ? 'bg-accent-600 hover:bg-accent-500 active:bg-accent-700 text-black'
        : accent === 'green'
        ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white'
        : accent === 'red'
        ? 'bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-red-300 border border-slate-700'
        : 'bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-slate-100 border border-slate-800'
    } ${className}`}
  >
    {children}
  </button>
);

export const KeypadGrid = ({ activeField, onDigit, onDot, onBackspace, onClearField, onNext, onSave }) => {
  const [bsTimer, setBsTimer] = useState(null);

  const handleBsDown = () => {
    const timer = setTimeout(() => {
      setBsTimer('cleared');
      onClearField();
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    }, 600);
    setBsTimer(timer);
  };

  const handleBsUp = () => {
    if (bsTimer === 'cleared') { setBsTimer(null); return; }
    if (bsTimer) { clearTimeout(bsTimer); setBsTimer(null); onBackspace(); }
  };

  const dotDisabled = activeField === 'reps';

  return (
    <div className="px-4 pb-4 pt-1">
      {/* 4-col grid, rows 1-4 */}
      <div className="grid grid-cols-4 gap-2" style={{ gridTemplateRows: 'repeat(4, 56px)' }}>
        {/* Row 1: 7 8 9 ← */}
        <Btn onClick={() => onDigit('7')} className="text-2xl h-14">7</Btn>
        <Btn onClick={() => onDigit('8')} className="text-2xl h-14">8</Btn>
        <Btn onClick={() => onDigit('9')} className="text-2xl h-14">9</Btn>
        <button
          onPointerDown={handleBsDown}
          onPointerUp={handleBsUp}
          onPointerLeave={handleBsUp}
          onContextMenu={(e) => e.preventDefault()}
          className="h-14 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-red-300 font-bold text-xl active:scale-95 border border-slate-700 select-none"
        >
          ⌫
        </button>

        {/* Row 2: 4 5 6  NEXT (rowspan 2) */}
        <Btn onClick={() => onDigit('4')} className="text-2xl h-14">4</Btn>
        <Btn onClick={() => onDigit('5')} className="text-2xl h-14">5</Btn>
        <Btn onClick={() => onDigit('6')} className="text-2xl h-14">6</Btn>
        {/* SIGUIENTE spans rows 2+3 */}
        <Btn
          onClick={onNext}
          accent="orange"
          className="row-span-2 h-[calc(112px+0.5rem)] flex-col gap-1"
        >
          <span className="text-[9px] uppercase tracking-widest font-black leading-none">SIG</span>
          <span className="text-2xl font-black leading-none">→</span>
        </Btn>

        {/* Row 3: 1 2 3 (col 4 occupied by SIGUIENTE) */}
        <Btn onClick={() => onDigit('1')} className="text-2xl h-14">1</Btn>
        <Btn onClick={() => onDigit('2')} className="text-2xl h-14">2</Btn>
        <Btn onClick={() => onDigit('3')} className="text-2xl h-14">3</Btn>

        {/* Row 4: .  0 0  ✓ */}
        <Btn
          onClick={dotDisabled ? undefined : onDot}
          className={`text-2xl h-14 ${dotDisabled ? 'opacity-25 pointer-events-none' : ''}`}
        >
          .
        </Btn>
        <Btn onClick={() => onDigit('0')} className="col-span-2 text-2xl h-14">0</Btn>
        <Btn onClick={onSave} accent="green" className="text-xl h-14">✓</Btn>
      </div>
    </div>
  );
};
