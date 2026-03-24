export const PLATE_CONFIG = {
  kg: {
    25: { color: "bg-red-600 border-red-800", height: "h-32", label: "25", type: "standard", text: "text-white" },
    20: { color: "bg-blue-600 border-blue-800", height: "h-32", label: "20", type: "standard", text: "text-white" },
    15: { color: "bg-yellow-400 border-yellow-600", height: "h-28", label: "15", type: "standard", text: "text-black" },
    10: { color: "bg-green-600 border-green-800", height: "h-24", label: "10", type: "standard", text: "text-white" },
    5: { color: "bg-slate-100 border-slate-300", height: "h-20", label: "5", type: "standard", text: "text-black" },
    2.5: { color: "bg-red-600 border-red-800", height: "h-16", label: "2.5", type: "fractional", text: "text-white" },
    2: { color: "bg-blue-500 border-blue-700", height: "h-16", label: "2", type: "fractional", text: "text-white" },
    1.5: { color: "bg-yellow-400 border-yellow-600", height: "h-14", label: "1.5", type: "fractional", text: "text-black" },
    1.25: { color: "bg-slate-400 border-slate-600", height: "h-14", label: "1.25", type: "fractional", text: "text-white" },
    1: { color: "bg-green-500 border-green-700", height: "h-12", label: "1", type: "fractional", text: "text-white" },
    0.5: { color: "bg-slate-100 border-slate-300", height: "h-10", label: "0.5", type: "fractional", text: "text-black" },
    0.25: { color: "bg-slate-300 border-slate-400", height: "h-9", label: "0.25", type: "fractional", text: "text-black" },
  },
  lb: {
    45: { color: "bg-blue-600 border-blue-800", height: "h-32", label: "45", type: "standard", text: "text-white" },
    35: { color: "bg-yellow-400 border-yellow-600", height: "h-28", label: "35", type: "standard", text: "text-black" },
    25: { color: "bg-green-600 border-green-800", height: "h-24", label: "25", type: "standard", text: "text-white" },
    10: { color: "bg-slate-100 border-slate-300", height: "h-20", label: "10", type: "standard", text: "text-black" },
    5: { color: "bg-black border-slate-600", height: "h-16", label: "5", type: "fractional", text: "text-white" },
    2.5: { color: "bg-slate-400 border-slate-600", height: "h-14", label: "2.5", type: "fractional", text: "text-white" },
    1.25: { color: "bg-slate-300 border-slate-500", height: "h-10", label: "1.25", type: "fractional", text: "text-black" },
  },
};

export const DEFAULT_INVENTORY_STATE = {
  kg: { 25: 6, 20: 8, 15: 4, 10: 4, 5: 4, 2.5: 4, 2: 2, 1.5: 2, 1.25: 4, 1: 2, 0.5: 2, 0.25: 2 },
  lb: { 45: 8, 35: 4, 25: 4, 10: 6, 5: 4, 2.5: 4, 1.25: 2 },
};

export const DEFAULT_EXERCISE_DB = [
  "Press Banca",
  "Press Banca Inclinado",
  "Aperturas de Pecho",
  "Cruce de Poleas",
  "Fondos en Paralelas",
  "Sentadilla",
  "Prensa de Piernas",
  "Extensiones de Cuádriceps",
  "Sentadilla Búlgara",
  "Sentadilla Hack",
  "Peso Muerto",
  "Peso Muerto Rumano",
  "Curl Femoral",
  "Hip Thrust",
  "Elevación de Gemelos",
  "Dominadas",
  "Remo con Barra",
  "Jalón al Pecho",
  "Remo en Punta",
  "Pull-over con Polea",
  "Press Militar",
  "Elevaciones Laterales",
  "Pájaros (Elevaciones Posteriores)",
  "Encogimientos de Hombros",
  "Curl de Bíceps",
  "Curl Martillo",
  "Curl Predicador",
  "Extensión de Tríceps",
  "Rompecráneos",
  "Press Francés",
  "Plancha Abdominal",
  "Crunch Abdominal",
  "Elevación de Piernas",
].sort();

export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
  "glutes",
  "hamstrings",
  "core",
];

export const EXERCISE_CATEGORIES = {
  chest: [
    "Press Banca",
    "Press Banca Inclinado",
    "Aperturas de Pecho",
    "Cruce de Poleas",
    "Fondos en Paralelas",
  ],
  back: [
    "Peso Muerto",
    "Dominadas",
    "Remo con Barra",
    "Jalón al Pecho",
    "Remo en Punta",
    "Pull-over con Polea",
  ],
  shoulders: [
    "Press Militar",
    "Elevaciones Laterales",
    "Pájaros (Elevaciones Posteriores)",
    "Encogimientos de Hombros",
  ],
  arms: [
    "Curl de Bíceps",
    "Curl Martillo",
    "Curl Predicador",
    "Extensión de Tríceps",
    "Rompecráneos",
    "Press Francés",
  ],
  legs: [
    "Sentadilla",
    "Prensa de Piernas",
    "Extensiones de Cuádriceps",
    "Sentadilla Búlgara",
    "Sentadilla Hack",
    "Elevación de Gemelos",
  ],
  glutes: ["Hip Thrust"],
  hamstrings: ["Peso Muerto Rumano", "Curl Femoral"],
  core: ["Plancha Abdominal", "Crunch Abdominal", "Elevación de Piernas"],
};

export const EQUIPMENT_TYPES = [
  { id: "barbell", label: "Barra" },
  { id: "dumbbell", label: "Mancuernas" },
  { id: "bodyweight", label: "Peso Corporal" },
  { id: "machine", label: "Máquina" },
  { id: "cable", label: "Polea" },
  { id: "smith", label: "Multipower" },
  { id: "kettlebell", label: "Kettlebell" },
];

export const DEFAULT_MODES = [
  { id: "standard", label: "Modo Libre", rpe: "-", repRange: "-", sets: "-", weightMod: 1.0, color: "text-slate-400", desc: "Registro manual sin asistencia." },
  { id: "m1_base", label: "MESO 1: Base", rpe: "7-8", repRange: "5-6", sets: 3, weightMod: 1.0, color: "text-blue-400", desc: "Acumula fatiga controlada." },
  { id: "m1_deload", label: "MESO 1: Descarga", rpe: "5", repRange: "5", sets: 2, weightMod: 0.6, color: "text-green-400", desc: "OBLIGATORIO. Pesos ligeros." },
  { id: "m2_int", label: "MESO 2: Fuerza", rpe: "8-9", repRange: "3-4", sets: 3, weightMod: 1.1, color: "text-amber-500", desc: "Sube peso, baja reps." },
  { id: "m2_deload", label: "MESO 2: Descarga", rpe: "5", repRange: "3", sets: 2, weightMod: 0.6, color: "text-green-400", desc: "Recuperación del SNC." },
  { id: "m3_peak", label: "MESO 3: Peaking", rpe: "9-10", repRange: "1-3", sets: 3, weightMod: 1.25, color: "text-red-600", desc: "Busca PRs (Récords)." },
];

export const PHASE_COLORS = [
  "text-blue-400",
  "text-green-400",
  "text-amber-500",
  "text-red-600",
  "text-purple-400",
  "text-pink-400",
  "text-sky-400",
];

export const SET_TYPES = {
  NORMAL: { id: "normal", label: "", color: "text-slate-500", bg: "bg-transparent" },
  WARMUP: { id: "warmup", label: "W", color: "text-yellow-200", bg: "bg-yellow-900/40" },
  TOP: { id: "top", label: "TOP", color: "text-amber-400", bg: "bg-amber-900/40" },
  BACKOFF: { id: "backoff", label: "BACK", color: "text-blue-300", bg: "bg-blue-900/40" },
  DROP: { id: "drop", label: "DROP", color: "text-red-400", bg: "bg-red-900/40" },
  AMRAP: { id: "amrap", label: "AMRAP", color: "text-purple-400", bg: "bg-purple-900/40" },
};

export const DEFAULT_ROUTINES = [
  {
    id: "routine-1",
    name: "Plantilla Push Alpha",
    lastPerformed: null,
    exercises: [
      { id: 101, name: "Press Banca", equipment: "barbell", sets: [{ weight: 0, reps: 10, rpe: 7, type: "normal" }] },
      { id: 102, name: "Press Militar", equipment: "dumbbell", sets: [{ weight: 0, reps: 10, rpe: 8, type: "normal" }] },
      { id: 103, name: "Fondos en Paralelas", equipment: "bodyweight", sets: [{ weight: 0, reps: 12, rpe: 9, type: "normal" }] },
    ],
  },
];

export const EXERCISE_TO_MUSCLE = Object.entries(EXERCISE_CATEGORIES).reduce(
  (acc, [muscle, exercises]) => {
    exercises.forEach((exercise) => {
      acc[exercise] = muscle;
    });
    return acc;
  },
  {}
);
