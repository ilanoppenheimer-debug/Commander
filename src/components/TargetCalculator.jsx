import React, { useState, useMemo } from 'react';
import InputGroup from "./ui/InputGroup";
import ToggleSwitch from "./ui/ToggleSwitch";
import { PLATE_CONFIG } from "../constants/gymConstants";
import { toKg, toLb, formatNum } from "../utils/weightUtils";

// 1. Componente visual de los discos
export const PlateVisualizer = ({ plates }) => {
  if (!Array.isArray(plates)) return null;
  const safePlates = plates.filter(Boolean);
  return (
    <div className="w-full h-40 bg-slate-900/50 rounded-xl flex items-center justify-start overflow-x-auto overflow-y-hidden border-b-4 border-slate-700 relative p-4 mb-4 shadow-inner">
      <div className="absolute left-0 w-full h-4 bg-slate-400 z-0 top-1/2 -translate-y-1/2 shadow-lg"></div>
      <div className="h-20 w-8 bg-slate-300 z-10 mr-1 shadow-xl border-r-2 border-slate-500 shrink-0 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
      </div>
      {safePlates.map((p, idx) => {
        if(!p) return null;
        const config = PLATE_CONFIG[p.unit]?.[p.weight];
        const fill = config?.fill || "#334155";
        const stroke = config?.stroke || "#1e293b";
        const textColor = config?.text || "#ffffff";
        return (
          <div key={idx} className="flex flex-col items-center justify-center z-20 -ml-1 shrink-0 transition-all duration-300 animate-slide-in-right group">
            <div
              style={{ backgroundColor: fill, borderColor: stroke }}
              className={`${config?.height || 'h-24'} w-6 rounded-sm border shadow-xl flex items-center justify-center relative`}
            >
              <span style={{ color: textColor }} className="text-[9px] font-bold -rotate-90 absolute whitespace-nowrap">{p.weight} <span className="text-[6px] opacity-70">{p.unit}</span></span>
              <div className="absolute inset-y-0 left-0 w-1 bg-white/10"></div>
            </div>
          </div>
        );
      })}
      {safePlates.length === 0 && <div className="z-10 text-slate-600 text-xs font-mono ml-4 bg-slate-900 px-2 py-1 rounded">Barra Vacía</div>}
    </div>
  );
};

// 2. La calculadora principal
export default function TargetCalculator({ barWeight, barUnit, inventory }) {
    const [targetWeight, setTargetWeight] = useState(100);
    const [unit, setUnit] = useState('kg');
    const [allowMixing, setAllowMixing] = useState(false); 
  
    const calculatePlates = () => {
      let t = parseFloat(targetWeight);
      if (isNaN(t) || t <= 0) return [];
      const barW = parseFloat(barWeight) || 0;
      let currentBar = barUnit === unit ? barW : (unit === 'kg' ? toKg(barW, 'lb') : toLb(barW, 'kg'));
      let weightNeeded = t - currentBar;
      let perSide = weightNeeded / 2;
      if (perSide <= 0) return [];
      let available = [];
      const safeInvKg = inventory?.kg || {};
      const safeInvLb = inventory?.lb || {};

      if (allowMixing) {
        const kgOpts = Object.entries(safeInvKg).filter(([_, count]) => count > 0).map(([w, count]) => ({ weight: parseFloat(w), unit: 'kg', count, compareWeight: unit === 'kg' ? parseFloat(w) : toLb(parseFloat(w), 'kg') }));
        const lbOpts = Object.entries(safeInvLb).filter(([_, count]) => count > 0).map(([w, count]) => ({ weight: parseFloat(w), unit: 'lb', count, compareWeight: unit === 'lb' ? parseFloat(w) : toKg(parseFloat(w), 'lb') }));
        available = [...kgOpts, ...lbOpts].sort((a, b) => b.compareWeight - a.compareWeight);
      } else {
        const currentInv = inventory?.[unit] || {};
        available = Object.entries(currentInv).filter(([_, count]) => count > 0).map(([w, count]) => ({ weight: parseFloat(w), unit: unit, count, compareWeight: parseFloat(w) })).sort((a, b) => b.compareWeight - a.compareWeight);
      }
      let remaining = perSide;
      const result = [];
      available.forEach(plate => {
        if (remaining <= 0) return;
        const weightVal = plate.compareWeight;
        const possibleCount = Math.floor((remaining + 0.01) / weightVal); 
        if (possibleCount > 0) {
          const maxPairs = Math.floor(plate.count / 2);
          const take = Math.min(possibleCount, maxPairs);
          if (take > 0) {
            for(let i=0; i<take; i++) { result.push({ weight: plate.weight, unit: plate.unit }); }
            remaining -= take * weightVal;
            remaining = Math.max(0, remaining);
          }
        }
      });
      return result; 
    };
  
    const plates = calculatePlates();
    const groupedPlates = useMemo(() => {
      const map = new Map();
      (plates || []).forEach(p => {
        if(!p) return;
        const key = `${p.weight}-${p.unit}`;
        if (!map.has(key)) map.set(key, { ...p, count: 0 });
        map.get(key).count++;
      });
      return Array.from(map.values()).sort((a, b) => b.weight - a.weight);
    }, [plates, unit]);
  
    const barW = parseFloat(barWeight) || 0;
    const totalExact = (plates || []).reduce((sum, p) => sum + (p?.unit === unit ? p.weight : (unit === 'kg' ? toKg(p?.weight, 'lb') : toLb(p?.weight, 'kg'))), 0) * 2 + (barUnit === unit ? barW : (unit === 'kg' ? toKg(barW, 'lb') : toLb(barW, 'kg')));
  
    return (
      <div className="space-y-6 animate-fade-in pb-20">
        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-xl md:grid md:grid-cols-2 md:gap-6">
         <div>
          <div className="flex gap-4 items-end mb-4">
            <div className="flex-1"><InputGroup label={`Peso Objetivo (${unit})`} type="number" value={targetWeight} onChange={setTargetWeight} /></div>
            <div className="flex bg-slate-900 rounded-lg p-1 h-[54px] items-center">
              {['kg', 'lb'].map((u) => (
                <button key={u} onClick={() => setUnit(u)} className={`px-3 py-2 h-full rounded-md text-sm font-bold transition-all ${unit === u ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>{u.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div className="mb-4"><ToggleSwitch checked={allowMixing} onChange={setAllowMixing} label={allowMixing ? "Combinando (Kg + Lb)" : "Solo un tipo"} /></div>
         </div>
         <div>
          <PlateVisualizer plates={plates} unit={unit} />
          <div className="space-y-2">
             <div className="text-xs uppercase text-slate-500 font-bold mb-2">Cargar por lado:</div>
             {groupedPlates.length > 0 ? (
               <div className="grid grid-cols-2 gap-2">
                 {groupedPlates.map((item, idx) => {
                   const cfg = PLATE_CONFIG[item.unit]?.[item.weight];
                   return (
                     <div key={idx} className="bg-slate-700/50 p-2 rounded-lg border border-slate-600 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                           <span style={{ backgroundColor: cfg?.fill || "#ffffff" }} className="w-3 h-3 rounded-full"></span>
                           <span className="font-bold text-white text-lg">{item.weight} <span className="text-xs text-slate-400">{item.unit}</span></span>
                        </div>
                        <span className="font-mono text-blue-400 font-bold">x{item.count}</span>
                     </div>
                   );
                 })}
               </div>
             ) : (<p className="text-slate-500 text-sm text-center py-2">Ingresa un peso válido.</p>)}
          </div>
         </div>
        </div>
         <div className="text-center text-xs text-slate-500">Peso Real Calculado: {formatNum(totalExact)} {unit}</div>
      </div>
    );
}