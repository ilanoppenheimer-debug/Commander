import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { PLATE_CONFIG } from '../constants/gymConstants';
import { toKg, toLb, formatNum } from '../utils/weightUtils';
import { PlateVisualizer } from './TargetCalculator';

export default function ReverseCalculator({ barWeight, barUnit }) {
    const [platesOnSide, setPlatesOnSide] = useState([]);
    const addPlate = (weight, unit) => { setPlatesOnSide([...platesOnSide, { weight, unit, id: Date.now() + Math.random() }]); };
    const removeLast = () => setPlatesOnSide(prev => prev.slice(0, -1));
    const reset = () => setPlatesOnSide([]);
    
    const sideKg = platesOnSide.reduce((acc, p) => acc + toKg(p.weight, p.unit), 0);
    const sideLb = platesOnSide.reduce((acc, p) => acc + toLb(p.weight, p.unit), 0);
    const barW = parseFloat(barWeight) || 0;
    const totalKg = (sideKg * 2) + toKg(barW, barUnit);
    const totalLb = (sideLb * 2) + toLb(barW, barUnit);
    
    const standardKg = Object.keys(PLATE_CONFIG.kg).map(Number).filter(w => PLATE_CONFIG.kg[w].type === 'standard').sort((a,b) => b-a);
    const standardLb = Object.keys(PLATE_CONFIG.lb).map(Number).filter(w => PLATE_CONFIG.lb[w].type === 'standard').sort((a,b) => b-a);
    const fractionalKg = Object.keys(PLATE_CONFIG.kg).map(Number).filter(w => PLATE_CONFIG.kg[w].type === 'fractional').sort((a,b) => b-a);
    const fractionalLb = Object.keys(PLATE_CONFIG.lb).map(Number).filter(w => PLATE_CONFIG.lb[w].type === 'fractional').sort((a,b) => b-a);
  
    return (
      <div className="space-y-4 animate-fade-in flex flex-col h-full pb-20">
        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-xl sticky top-0 z-10">
          <div className="flex justify-between items-end">
             <div>
               <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Peso Total</div>
               <div className="text-4xl font-black text-white leading-none">{formatNum(totalLb)} <span className="text-xl text-blue-500">lb</span></div>
               <div className="text-sm font-bold text-emerald-400 mt-1">{formatNum(totalKg)} kg</div>
             </div>
             <button onClick={reset} className="text-red-400 p-2 hover:bg-red-500/10 rounded-lg"><RotateCcw size={20} /></button>
          </div>
        </div>
        <div className="relative">
           <PlateVisualizer plates={platesOnSide} />
           {platesOnSide.length > 0 && (<button onClick={removeLast} className="absolute right-2 bottom-6 text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded border border-red-500/30 hover:bg-red-500/30">Quitar último</button>)}
        </div>
        <div className="space-y-6">
           <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-emerald-500 uppercase mb-2 flex items-center gap-2">Kilos</h4>
              <div className="grid grid-cols-4 gap-2 mb-2">{standardKg.map(w => (<button key={`kg-${w}`} onClick={() => addPlate(w, 'kg')} className={`h-12 rounded-lg font-bold shadow-sm active:scale-95 border-b-4 flex items-center justify-center ${PLATE_CONFIG.kg[w]?.color?.replace('h-', '')?.replace('w-', '') || ''} ${PLATE_CONFIG.kg[w]?.text || 'text-white'} border-opacity-50`}>{w}</button>))}</div>
              <h5 className="text-[10px] text-slate-500 font-bold uppercase mb-2 mt-3">Micro</h5>
              <div className="grid grid-cols-6 gap-2">{fractionalKg.map(w => (<button key={`kg-${w}`} onClick={() => addPlate(w, 'kg')} className={`h-10 text-xs rounded-lg font-bold shadow-sm active:scale-95 border-b-2 flex items-center justify-center ${PLATE_CONFIG.kg[w]?.color?.replace('h-', '')?.replace('w-', '') || ''} ${PLATE_CONFIG.kg[w]?.text || 'text-white'} border-opacity-50`}>{w}</button>))}</div>
           </div>
           <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-blue-500 uppercase mb-2 flex items-center gap-2">Libras</h4>
              <div className="grid grid-cols-4 gap-2 mb-2">{standardLb.map(w => (<button key={`lb-${w}`} onClick={() => addPlate(w, 'lb')} className={`h-12 rounded-lg font-bold shadow-sm active:scale-95 border-b-4 flex items-center justify-center ${PLATE_CONFIG.lb[w]?.color?.replace('h-', '')?.replace('w-', '') || ''} ${PLATE_CONFIG.lb[w]?.text || 'text-white'} border-opacity-50`}>{w}</button>))}</div>
              <h5 className="text-[10px] text-slate-500 font-bold uppercase mb-2 mt-3">Micro</h5>
              <div className="grid grid-cols-6 gap-2">{fractionalLb.map(w => (<button key={`lb-${w}`} onClick={() => addPlate(w, 'lb')} className={`h-10 text-xs rounded-lg font-bold shadow-sm active:scale-95 border-b-2 flex items-center justify-center ${PLATE_CONFIG.lb[w]?.color?.replace('h-', '')?.replace('w-', '') || ''} ${PLATE_CONFIG.lb[w]?.text || 'text-white'} border-opacity-50`}>{w}</button>))}</div>
           </div>
        </div>
      </div>
    );
}