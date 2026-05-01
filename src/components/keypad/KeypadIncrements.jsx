import { useState } from 'react';
import { getIncrementsFor } from './keypadConfig';
import { IncrementSelector } from './IncrementSelector';
import { useLongPress } from '../../hooks/useLongPress';

export const KeypadIncrements = ({ activeField, equipment, exerciseMeta, globalOverrides, onIncrement, onChangeIncrement }) => {
  const [selectorOpen, setSelectorOpen] = useState(null); // 'small' | 'large' | null

  const increments = getIncrementsFor(activeField, equipment, exerciseMeta, globalOverrides);

  const longPressSmall = useLongPress(() => setSelectorOpen('small'), 500);
  const longPressLarge = useLongPress(() => setSelectorOpen('large'), 500);

  const handleTap = (sign, size, longPressObj) => (e) => {
    if (longPressObj.wasTriggered()) return; // was long-pressed, skip tap
    onIncrement(sign * (size === 'small' ? increments.small : increments.large));
  };

  return (
    <div className="px-4 pb-2 relative">
      <div className="text-[9px] uppercase tracking-widest font-bold text-slate-500 mb-2">
        Ajuste rápido
      </div>
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={handleTap(-1, 'large', longPressLarge)}
          {...longPressLarge}
          className="bg-slate-900 active:bg-slate-700 border border-slate-700 rounded-xl py-3 text-red-400 font-black text-base active:scale-95 transition-transform select-none"
        >
          −{increments.large}
        </button>
        <button
          onClick={handleTap(-1, 'small', longPressSmall)}
          {...longPressSmall}
          className="bg-slate-900 active:bg-slate-700 border border-slate-700 rounded-xl py-3 text-red-300/80 font-black text-sm active:scale-95 transition-transform select-none"
        >
          −{increments.small}
        </button>
        <button
          onClick={handleTap(+1, 'small', longPressSmall)}
          {...longPressSmall}
          className="bg-slate-900 active:bg-slate-700 border border-slate-700 rounded-xl py-3 text-emerald-300/80 font-black text-sm active:scale-95 transition-transform select-none"
        >
          +{increments.small}
        </button>
        <button
          onClick={handleTap(+1, 'large', longPressLarge)}
          {...longPressLarge}
          className="bg-slate-900 active:bg-slate-700 border border-slate-700 rounded-xl py-3 text-emerald-400 font-black text-base active:scale-95 transition-transform select-none"
        >
          +{increments.large}
        </button>
      </div>

      {selectorOpen && (
        <IncrementSelector
          field={activeField}
          equipment={equipment}
          options={increments.options}
          currentSmall={increments.small}
          currentLarge={increments.large}
          target={selectorOpen}
          onSelect={(newValue) => {
            if (onChangeIncrement) onChangeIncrement(activeField, equipment, selectorOpen, newValue);
            setSelectorOpen(null);
          }}
          onClose={() => setSelectorOpen(null)}
        />
      )}
    </div>
  );
};
