export const PLATE_CONFIG = {
  kg: {
    25: { color: 'bg-red-600 border-red-800', height: 'h-32', label: '25', type: 'standard', text: 'text-white' },
    20: { color: 'bg-blue-600 border-blue-800', height: 'h-32', label: '20', type: 'standard', text: 'text-white' },
    15: { color: 'bg-yellow-400 border-yellow-600', height: 'h-28', label: '15', type: 'standard', text: 'text-black' },
    10: { color: 'bg-green-600 border-green-800', height: 'h-24', label: '10', type: 'standard', text: 'text-white' },
    5: { color: 'bg-slate-100 border-slate-300', height: 'h-20', label: '5', type: 'standard', text: 'text-black' },
    2.5: { color: 'bg-red-600 border-red-800', height: 'h-16', label: '2.5', type: 'fractional', text: 'text-white' },
    2: { color: 'bg-blue-500 border-blue-700', height: 'h-16', label: '2', type: 'fractional', text: 'text-white' },
    1.5: { color: 'bg-yellow-400 border-yellow-600', height: 'h-14', label: '1.5', type: 'fractional', text: 'text-black' },
    1.25: { color: 'bg-slate-400 border-slate-600', height: 'h-14', label: '1.25', type: 'fractional', text: 'text-white' },
    1: { color: 'bg-green-500 border-green-700', height: 'h-12', label: '1', type: 'fractional', text: 'text-white' },
    0.5: { color: 'bg-slate-100 border-slate-300', height: 'h-10', label: '0.5', type: 'fractional', text: 'text-black' },
    0.25: { color: 'bg-slate-300 border-slate-400', height: 'h-9', label: '0.25', type: 'fractional', text: 'text-black' },
  },
  lb: {
    45: { color: 'bg-blue-600 border-blue-800', height: 'h-32', label: '45', type: 'standard', text: 'text-white' },
    35: { color: 'bg-yellow-400 border-yellow-600', height: 'h-28', label: '35', type: 'standard', text: 'text-black' },
    25: { color: 'bg-green-600 border-green-800', height: 'h-24', label: '25', type: 'standard', text: 'text-white' },
    10: { color: 'bg-slate-100 border-slate-300', height: 'h-20', label: '10', type: 'standard', text: 'text-black' },
    5: { color: 'bg-black border-slate-600', height: 'h-16', label: '5', type: 'fractional', text: 'text-white' },
    2.5: { color: 'bg-slate-400 border-slate-600', height: 'h-14', label: '2.5', type: 'fractional', text: 'text-white' },
    1.25: { color: 'bg-slate-300 border-slate-500', height: 'h-10', label: '1.25', type: 'fractional', text: 'text-black' },
  }
};

export const DEFAULT_INVENTORY_STATE = {
  kg: { 25: 6, 20: 8, 15: 4, 10: 4, 5: 4, 2.5: 4, 2: 2, 1.5: 2, 1.25: 4, 1: 2, 0.5: 2, 0.25: 2 },
  lb: { 45: 8, 35: 4, 25: 4, 10: 6, 5: 4, 2.5: 4, 1.25: 2 }
};

export const DEFAULT_EXERCISE_DB = [
  "Press Banca", "Press Banca Inclinado", "Aperturas de Pecho", "Cruce de Poleas",
  "Fondos en Paralelas", "Sentadilla", "Prensa de Piernas"
].sort();

export const EQUIPMENT_TYPES = [
  { id: 'barbell', label: 'Barra' },
  { id: 'dumbbell', label: 'Mancuernas' },
  { id: 'bodyweight', label: 'Peso Corporal' },
  { id: 'machine', label: 'Máquina' },
  { id: 'cable', label: 'Polea' }
];

export const DEFAULT_MODES = [
  { id: 'standard', label: 'Modo Libre', rpe: '-', repRange: '-', sets: '-', weightMod: 1.0 }
];

export const PHASE_COLORS = ['text-blue-400','text-green-400','text-amber-500'];

export const SET_TYPES = {
  NORMAL: { id: 'normal', label: '' },
  WARMUP: { id: 'warmup', label: 'W' }
};

export const DEFAULT_ROUTINES = [
  {
    id: 'routine-1',
    name: 'Plantilla Push Alpha',
    exercises: []
  }
];