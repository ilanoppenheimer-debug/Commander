// Phase 2 of the exercise taxonomy: how every historical exercise name maps to its VARIANT
// (the name that carries the numbers) and which implement each appearance really used.
// Reviewed by hand against the Oct-28 backup and the athlete's mapping sheet — not inferred.
// Data only: the logic that applies it is planTaxonomyMigration (taxonomyMigration.js).
//
// A rule:
//   from  exact historical spellings (matched by app identity: case/accents/spacing)
//   to    the variant name
//   all   the variant has ONE possible implement: every appearance gets it
//   fix   per-appearance corrections [{ date?:'YYYY-MM-DD' (UTC day of completedAt),
//         from?:implement, to:implement|null, expect:n }]
//   expect  how many appearances `all` changes in the reviewed backup (informational)
export const TAXONOMY_RULES = [
  { from: ['Sentadilla'], to: 'Sentadilla' },
  { from: ['Sentadilla Hack'], to: 'Sentadilla Hack', all: 'machine', expect: 1 },
  { from: ['Sentadilla péndulo'], to: 'Sentadilla Péndulo', all: 'machine', expect: 1 },
  { from: ['V squat'], to: 'V Squat', all: 'machine', expect: 2 },
  { from: ['Prensa de Piernas'], to: 'Prensa de Piernas', all: 'machine', expect: 1 },
  { from: ['Prensa de piernas unilateral'], to: 'Prensa de Piernas Unilateral', all: 'machine', expect: 1 },
  { from: ['Peso Muerto'], to: 'Peso Muerto' },
  { from: ['RDL'], to: 'RDL' },
  { from: ['Buenos Días'], to: 'Buenos Días' },
  { from: ['Press Banca'], to: 'Press Banca' },
  { from: ['Press banca agarre cerado'], to: 'Press Banca Agarre Cerrado' },
  { from: ['Press Banca Inclinado', 'Press Inclinado Mancuernas'], to: 'Press Inclinado', fix: [{ date: '2026-09-04', from: 'barbell', to: 'dumbbell', expect: 1 }] },
  { from: ['Press Militar', 'Press Militar Estricto'], to: 'Press Militar' },
  { from: ['Push-Ups'], to: 'Push-Ups' },
  { from: ['Push-Ups Pies Elevados'], to: 'Decline Push-Ups' },
  { from: ['Push-Ups Pies Elevados + Paralelas'], to: 'Decline Push-Ups en Paralelas' },
  { from: ['Dominadas', 'Dominadas — Test Máximo'], to: 'Dominadas', all: 'bodyweight', expect: 2 },
  { from: ['Muscle-Up'], to: 'Muscle-Up' },
  { from: ['Jalón al pecho', 'Jalón al Pecho'], to: 'Jalón al Pecho' },
  { from: ['Jalón en Polea a una mano'], to: 'Jalón a una mano' },
  { from: ['Remo con Barra'], to: 'Remo con Barra', fix: [{ from: 'cable', to: 'barbell', expect: 2 }] },
  { from: ['Remo mancuerna'], to: 'Remo Mancuerna', fix: [{ from: 'cable', to: 'dumbbell', expect: 1 }] },
  { from: ['Remo en punta', 'Remo en Punta'], to: 'Remo Landmine', all: 'landmine', expect: 4 },
  { from: ['Remo en Polea'], to: 'Remo en Polea' },
  { from: ['Remo en T con apoyo'], to: 'Remo en T con apoyo' },
  { from: ['Remo Polea / Landmine', 'Remo en Polea / Landmine'], to: 'Remo Polea / Landmine (sin resolver)' },
  { from: ['Curl de Bíceps'], to: 'Curl de Bíceps' },
  { from: ['Curl de bicep con barra', 'Curl de biceps con barra'], to: 'Curl de Bíceps', fix: [{ date: '2026-09-04', from: 'cable', to: 'barbell', expect: 1 }, { date: '2026-10-07', from: 'dumbbell', to: 'barbell', expect: 1 }] },
  { from: ['Curl de biceps bayesiano'], to: 'Curl Bayesiano', all: 'cable', expect: 1 },
  { from: ['Hammer curl'], to: 'Hammer Curl', fix: [{ date: '2026-05-03', from: 'barbell', to: 'dumbbell', expect: 1 }] },
  { from: ['Extensión de Tríceps'], to: 'Extensión de Tríceps', fix: [{ date: '2026-07-08', from: 'barbell', to: 'cable', expect: 1 }] },
  { from: ['Extensión tríceps katana'], to: 'Extensión Tríceps Katana' },
  { from: ['Rompecráneos'], to: 'Rompecráneos', fix: [{ date: '2026-09-04', from: 'cable', to: 'barbell', expect: 1 }] },
  { from: ['Extensión de Tríceps con Mancuerna'], to: 'Rompecráneos', all: 'dumbbell', expect: 0 },
  { from: ['Elevaciones Laterales'], to: 'Elevaciones Laterales', fix: [{ from: 'barbell', to: 'dumbbell', expect: 2 }] },
  { from: ['Elevaciones laterales con polea'], to: 'Elevaciones Laterales', fix: [{ date: '2026-09-10', from: 'dumbbell', to: 'cable', expect: 1 }] },
  { from: ['Facepull'], to: 'Facepull', all: 'cable', expect: 1 },
  { from: ['Pajaros rear delts'], to: 'Pájaros' },
  { from: ['Curl Femoral'], to: 'Curl Femoral Sentado', all: 'machine', expect: 0 },
  { from: ['Flexion de piernas'], to: 'Curl Femoral Sentado', all: 'machine', expect: 1 },
  { from: ['Curl femoral acostado'], to: 'Curl Femoral Acostado', all: 'machine', expect: 0 },
  { from: ['Extensiones de Cuádriceps'], to: 'Extensión de Cuádriceps', all: 'machine', expect: 2 },
  { from: ['Abducción de piernas'], to: 'Abducción de Piernas', all: 'machine', expect: 1 },
  { from: ['Elevación de Gemelos'], to: 'Elevación de Gemelos', all: 'machine', expect: 2 },
  { from: ['Cruce de Poleas'], to: 'Aperturas', all: 'cable', expect: 0 },
  { from: ['Core Anti-extensión'], to: 'Plancha', fix: [{ from: 'cable', to: 'bodyweight', expect: 4 }] },
  { from: ['Plancha Abdominal'], to: 'Plancha', fix: [{ from: 'barbell', to: 'bodyweight', expect: 1 }] },
  { from: ['Handstand'], to: 'Handstand' },
  { from: ['Handstand en Paralelas — Hold Máximo'], to: 'Handstand en Paralelas' },
  { from: ['Front Lever'], to: 'Front Lever Advanced Tuck' },
  { from: ['Tuck Front Lever'], to: 'Front Lever Tuck', fix: [{ from: 'barbell', to: 'bodyweight', expect: 1 }] },
  { from: ['Manguito Rotador'], to: 'Manguito Rotador', fix: [{ from: 'other', to: null, expect: 1 }] },
  { from: ['Prevención — Extensión de Muñeca'], to: 'Extensión de Muñeca' },
  { from: ['Extensión de muñecas'], to: 'Extensión de Muñeca', all: 'cable', expect: 0 },
  { from: ['Curl de Muñeca'], to: 'Flexión de Muñeca', all: 'cable', expect: 0 },
  { from: ['Rotaciones internas de hombro'], to: 'Rotación Interna', all: 'cable', expect: 0 },
  { from: ['Rotacion externa de hombro'], to: 'Rotación Externa', all: 'cable', expect: 0 },
  { from: ['Encogimientos de Hombros'], to: 'Encogimientos', all: 'machine', expect: 0 },
  { from: ['Cardio'], to: 'Cardio (sin especificar)' },
  { from: ['Bicicleta'], to: 'Bicicleta' },
  { from: ['Hip Thrust'], to: 'Hip Thrust' },
  { from: ['Press Banca con Pausa'], to: 'Press Banca con Pausa' },
  { from: ['Sentadilla Búlgara'], to: 'Sentadilla Búlgara' },
];

// Metadata keys that are the same exercise under another label (no history/routines use them):
// they are folded into the variant's key.
export const TAXONOMY_META_ALIASES = {
  'Curl Femoral (sentado)': 'Curl Femoral Sentado',
  'Remo con Mancuerna': 'Remo Mancuerna',
  'Cruce en Polea': 'Aperturas',
};

// The athlete's explicit decisions for a variant's DEFAULT implement in metadata. These
// replace values that came from the old 'barbell' default of the create modal (flagged
// user-manual but never a real choice).
export const TAXONOMY_META_EQUIPMENT = {
  'Remo Landmine': 'landmine',
  'Front Lever Tuck': 'bodyweight',
  'Manguito Rotador': 'dumbbell',
  'Muscle-Up': 'bodyweight',
  'Curl de Bíceps': 'dumbbell',
  'Sentadilla Péndulo': 'machine',
  'Jalón al Pecho': 'machine',
};

// Custom exercises that only existed to test: removed ONLY if nothing uses them (re-checked live).
export const TAXONOMY_JUNK = ['Ffff', 'Plancha Prueba W', 'Dominadas Prueba W'];

// Sessions saved several times by one repeated tap (distinct historyId, same content within
// seconds). Keep the one the athlete later edited ("Piernas B", updatedAt 5-may); remove the
// identical copies — each one is re-verified against the kept session before it is removed.
export const TAXONOMY_DUPLICATE_SESSIONS = [
  {
    keep: 'hist-1777592033527',
    remove: ['hist-1777592023231', 'hist-1777592024385', 'hist-1777592027830', 'hist-1777592032732', 'hist-1777592032917'],
  },
];

export const TAXONOMY_FLAG = 'taxonomyV1';
