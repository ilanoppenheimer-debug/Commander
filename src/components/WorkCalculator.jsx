import React, { useState } from 'react';
import { Dumbbell, TrendingUp, ChevronDown, BarChart2, Minus, Plus, Sparkles } from 'lucide-react';
import InputGroup from "./ui/InputGroup";
import InfoModal from "./ui/InfoModal";
import { DEFAULT_EXERCISE_DB } from "../constants/gymConstants";
import { formatNum } from "../utils/weightUtils";
import { calculate1RM, calculateTrainingWeight } from "../utils/strengthMath";
import { callGeminiAPI } from "../services/aiService";

export default function WorkCalculator() {
    const [liftWeight, setLiftWeight] = useState('');
    const [liftReps, setLiftReps] = useState('');
    const [liftRPE, setLiftRPE] = useState('');
    const [formula, setFormula] = useState('hybrid');
    const [unit, setUnit] = useState('kg');
    const [targetReps, setTargetReps] = useState(8);
    const [targetRPE, setTargetRPE] = useState(8);
    const [exercise, setExercise] = useState(DEFAULT_EXERCISE_DB[0]);
    const [aiAdvice, setAiAdvice] = useState('');
    const [loadingAI, setLoadingAI] = useState(false);
    const [showAI, setShowAI] = useState(false);
  
    const oneRM = calculate1RM(liftWeight, liftReps, liftRPE, formula);
    const workWeight = oneRM ? calculateTrainingWeight(oneRM, targetReps, targetRPE) : 0;
  
    const handleAIConsult = async () => {
      setShowAI(true);
      setLoadingAI(true);
      const prompt = `Actúa como coach. Ejercicio: ${exercise}. 1RM Est: ${formatNum(oneRM)} ${unit}. Objetivo: ${formatNum(workWeight)} ${unit} x ${targetReps} reps @ RPE ${targetRPE}. Dame 1 consejo técnico, sensación RPE y calentamiento breve.`;
      try {
          const advice = await callGeminiAPI(prompt);
          setAiAdvice(advice);
      } catch(e) { setAiAdvice("Error conexión."); }
      setLoadingAI(false);
    };
  
    return (
      <div className="space-y-6 animate-fade-in pb-20">
        <div className="bg-slate-800 p-2 rounded-xl border border-slate-700 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2 pl-2"><Dumbbell className="text-blue-500" size={18} /><span className="text-xs font-bold text-slate-400 uppercase">Ejercicio:</span></div>
          <div className="relative w-1/2">
            <select value={exercise} onChange={(e) => setExercise(e.target.value)} className="w-full bg-transparent text-white font-bold text-sm appearance-none pr-8 py-2 pl-2 outline-none cursor-pointer truncate">
              {DEFAULT_EXERCISE_DB.map(ex => <option key={ex} value={ex} className="bg-slate-900">{ex}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14} />
          </div>
        </div>
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl">
          <div className="flex justify-between mb-4"><h2 className="font-bold flex items-center gap-2 text-purple-400"><TrendingUp size={20} /> Calc 1RM</h2><select value={formula} onChange={(e) => setFormula(e.target.value)} className="bg-slate-900 text-xs font-bold text-slate-400 border border-slate-700 rounded px-2 outline-none"><option value="epley">Epley</option><option value="brzycki">Brzycki</option><option value="hybrid">Híbrida</option></select></div>
          <div className="grid grid-cols-2 gap-3 mb-3">
             <div className="col-span-2 flex gap-2"><div className="flex-1"><InputGroup label="Peso" type="number" value={liftWeight} onChange={setLiftWeight} placeholder="100" /></div><div className="w-20 pt-6"><button onClick={() => setUnit(unit === 'kg' ? 'lb' : 'kg')} className="w-full h-[52px] bg-slate-700 rounded-xl font-bold border border-slate-600 hover:bg-slate-600 transition-colors">{unit.toUpperCase()}</button></div></div>
             <InputGroup label="Reps" type="number" value={liftReps} onChange={setLiftReps} placeholder="5" />
             <InputGroup label="RPE" type="number" value={liftRPE} onChange={setLiftRPE} placeholder="10" step="0.5" />
          </div>
          {oneRM > 0 && (<div className="mt-4 bg-purple-900/20 p-4 rounded-xl border border-purple-500/30 text-center animate-pop-in"><div className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">Tu 1RM Teórico</div><div className="text-4xl font-black text-white">{formatNum(oneRM)} {unit}</div></div>)}
        </div>
        {oneRM > 0 && (
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4 flex gap-2 items-center"><BarChart2 size={16} /> Planificar Serie</h3>
            <div className="flex gap-4 mb-6">
              <div className="flex-1"><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Reps</label><div className="bg-slate-900 rounded-lg flex items-center p-1 border border-slate-700"><button onClick={() => setTargetReps(Math.max(1, targetReps-1))} className="p-2 text-slate-400 hover:text-white"><Minus size={14}/></button><div className="flex-1 text-center font-bold">{targetReps}</div><button onClick={() => setTargetReps(targetReps+1)} className="p-2 text-slate-400 hover:text-white"><Plus size={14}/></button></div></div>
              <div className="flex-1"><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">RPE</label><div className="bg-slate-900 rounded-lg flex items-center p-1 border border-slate-700"><button onClick={() => setTargetRPE(Math.max(1, targetRPE-0.5))} className="p-2 text-slate-400 hover:text-white"><Minus size={14}/></button><div className="flex-1 text-center font-bold text-blue-400">{targetRPE}</div><button onClick={() => setTargetRPE(Math.min(10, targetRPE+0.5))} className="p-2 text-slate-400 hover:text-white"><Plus size={14}/></button></div></div>
            </div>
            <div className="text-center mb-6"><div className="text-slate-400 text-xs mb-1">Cargar en la barra:</div><div className="text-5xl font-black text-white tracking-tighter">{formatNum(workWeight)} <span className="text-2xl text-emerald-500">{unit}</span></div></div>
            <button onClick={handleAIConsult} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 transition-all active:scale-95 group"><Sparkles className="text-yellow-300 group-hover:animate-pulse" size={18} /> Consultar Coach AI</button>
          </div>
        )}
        {showAI && <InfoModal data={{title: "Coach AI", content: loadingAI ? "Analizando..." : aiAdvice}} onClose={() => setShowAI(false)} />}
      </div>
    );
}