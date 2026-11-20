import { normalizeExerciseName } from '../utils/exerciseName';

// Exercise families (phase 4 of the taxonomy). Generated from the "Taxonomía de ejercicios"
// sheet (tab Familias v2) + the decisions of 13-15 Nov 2026.
//
//   family  -> only GROUPS (selector, search, reports by family). Cheap to correct.
//   name    -> the variant: the exercise name, and the numeric identity (phase 3).
//   equipment -> implements the variant OFFERS (ids of EQUIPMENT_TYPES); [] = none declared
//                ("sin definir"). Not a restriction: any implement can still be picked.
//   unilateral -> one side at a time. Absent = bilateral (dumbbells moved together are bilateral).
//                true = always; [implements] = only with those (Elevaciones Laterales: ['cable']).
//   measurement -> 'reps' | 'time'. Read as a FALLBACK by getMeasurement when the exercise has no
//                metadata of its own (new time variants: Plancha Lateral, Front Lever *, Cardio...).
//   inSelector -> false = hidden from the selector but still RESOLVES its family for the history.
//   status  -> 'historial' | 'nueva' | 'metadata' (informative).
//
// Nothing here is written to the history. The athlete's own choice (exerciseMetadata.family) wins
// over this table; see resolveFamily in constants/exerciseMetadata.js.
export const FAMILY_TABLE = Object.freeze([
  { family: "Sentadilla", name: "Sentadilla", equipment: ["barbell", "smith"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Sentadilla", name: "Sentadilla Frontal", equipment: ["barbell", "smith"], measurement: "reps", inSelector: true, status: "nueva" },
  { family: "Sentadilla", name: "Sentadilla Goblet", equipment: ["dumbbell", "kettlebell"], measurement: "reps", inSelector: true, status: "nueva" },
  { family: "Sentadilla", name: "Sissy Squat", equipment: ["bodyweight", "machine"], measurement: "reps", inSelector: true, status: "nueva" },
  { family: "Sentadilla", name: "Sentadilla Hack", equipment: ["machine"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Sentadilla", name: "Sentadilla Péndulo", equipment: ["machine"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Sentadilla", name: "V Squat", equipment: ["machine"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Prensa", name: "Prensa de Piernas", equipment: ["machine"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Prensa", name: "Prensa de Piernas Unilateral", equipment: ["machine"], unilateral: true, measurement: "reps", inSelector: true, status: "historial" },
  { family: "Peso Muerto", name: "Peso Muerto", equipment: ["barbell"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "RDL", name: "RDL", equipment: ["barbell", "dumbbell", "smith"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "RDL", name: "RDL en Belt Squat", equipment: ["machine"], measurement: "reps", inSelector: true, status: "nueva" },
  { family: "RDL", name: "Buenos Días", equipment: ["barbell", "smith"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "RDL", name: "Buenos Días en Hack", equipment: ["machine"], measurement: "reps", inSelector: true, status: "nueva" },
  { family: "RDL", name: "Buenos Días en V Squat", equipment: ["machine"], measurement: "reps", inSelector: true, status: "nueva" },
  { family: "Hip Thrust", name: "Hip Thrust", equipment: ["barbell", "machine", "dumbbell", "bodyweight"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Split Squat", name: "Sentadilla Búlgara", equipment: ["dumbbell", "barbell", "smith", "bodyweight"], unilateral: true, measurement: "reps", inSelector: true, status: "historial" },
  { family: "Press Banca", name: "Press Banca", equipment: ["barbell", "dumbbell", "smith"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Press Banca", name: "Press Banca Agarre Cerrado", equipment: ["barbell"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Press Banca", name: "Press Banca con Pausa", equipment: ["barbell"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Press Inclinado", name: "Press Inclinado", equipment: ["barbell", "dumbbell", "smith"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Press Militar", name: "Press Militar", equipment: ["barbell", "dumbbell"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Press Militar", name: "Press Militar Sentado", equipment: ["barbell", "dumbbell", "machine"], measurement: "reps", inSelector: true, status: "nueva" },
  { family: "Flexiones", name: "Push-Ups", equipment: ["bodyweight"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Flexiones", name: "Push-Ups en Paralelas", equipment: ["bodyweight"], measurement: "reps", inSelector: true, status: "nueva" },
  { family: "Flexiones Declinadas", name: "Decline Push-Ups", equipment: ["bodyweight"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Flexiones Declinadas", name: "Decline Push-Ups en Paralelas", equipment: ["bodyweight"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Dominadas", name: "Dominadas", equipment: ["bodyweight"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Muscle-Up", name: "Muscle-Up", equipment: ["bodyweight"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Jalón", name: "Jalón al Pecho", equipment: ["machine", "cable"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Jalón", name: "Jalón a una mano", equipment: ["cable", "machine"], unilateral: true, measurement: "reps", inSelector: true, status: "historial" },
  { family: "Remo", name: "Remo con Barra", equipment: ["barbell"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Remo", name: "Remo Mancuerna", equipment: ["dumbbell"], unilateral: true, measurement: "reps", inSelector: true, status: "historial" },
  { family: "Remo", name: "Remo Landmine", equipment: ["landmine"], unilateral: true, measurement: "reps", inSelector: true, status: "historial" },
  { family: "Remo", name: "Remo en Polea", equipment: ["cable"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Remo", name: "Remo en T con apoyo", equipment: ["machine", "landmine"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Remo", name: "Remo Polea / Landmine (sin resolver)", equipment: [], measurement: "reps", inSelector: false, status: "historial" },
  { family: "Curl de Bíceps", name: "Curl de Bíceps", equipment: ["barbell", "dumbbell", "cable"], unilateral: ["cable"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Curl de Bíceps", name: "Curl Bayesiano", equipment: ["cable"], unilateral: true, measurement: "reps", inSelector: true, status: "historial" },
  { family: "Curl de Bíceps", name: "Hammer Curl", equipment: ["dumbbell", "cable"], unilateral: ["cable"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Extensión de Tríceps", name: "Extensión de Tríceps", equipment: ["cable"], unilateral: ["cable"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Extensión de Tríceps", name: "Extensión Tríceps Katana", equipment: ["cable"], unilateral: true, measurement: "reps", inSelector: true, status: "historial" },
  { family: "Extensión de Tríceps", name: "Rompecráneos", equipment: ["barbell", "dumbbell"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Elevaciones Laterales", name: "Elevaciones Laterales", equipment: ["dumbbell", "cable", "machine"], unilateral: ["cable"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Elevaciones Frontales", name: "Reverse Front Fly", equipment: ["cable"], unilateral: true, measurement: "reps", inSelector: true, status: "historial" },
  { family: "Facepull", name: "Facepull", equipment: ["cable"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Pájaros", name: "Pájaros", equipment: ["cable", "dumbbell"], unilateral: ["cable"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Encogimientos", name: "Encogimientos", equipment: ["machine", "barbell", "dumbbell"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Aperturas", name: "Aperturas", equipment: ["cable", "dumbbell"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Curl Femoral", name: "Curl Femoral Sentado", equipment: ["machine"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Curl Femoral", name: "Curl Femoral Acostado", equipment: ["machine"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Curl Femoral", name: "Nordic Curl", equipment: ["bodyweight"], measurement: "reps", inSelector: true, status: "nueva" },
  { family: "Extensión de Cuádriceps", name: "Extensión de Cuádriceps", equipment: ["machine"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Abducción", name: "Abducción de Piernas", equipment: ["machine"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Gemelos", name: "Elevación de Gemelos", equipment: ["machine"], measurement: "reps", inSelector: true, status: "historial" },
  { family: "Tibial Anterior", name: "Tibial Anterior", equipment: [], measurement: "reps", inSelector: true, status: "metadata" },
  { family: "Core", name: "Plancha", equipment: ["bodyweight"], measurement: "time", inSelector: true, status: "historial" },
  { family: "Core", name: "Plancha Lateral", equipment: ["bodyweight"], unilateral: true, measurement: "time", inSelector: true, status: "nueva" },
  { family: "Core", name: "Knee Raises", equipment: ["bodyweight"], measurement: "reps", inSelector: true, status: "nueva" },
  { family: "Core", name: "Leg Raises", equipment: ["bodyweight"], measurement: "reps", inSelector: true, status: "nueva" },
  { family: "Core", name: "Ab Wheel", equipment: ["bodyweight"], measurement: "reps", inSelector: true, status: "nueva" },
  { family: "Core", name: "Dragon Flag", equipment: ["bodyweight"], measurement: "reps", inSelector: true, status: "nueva" },
  { family: "Core", name: "Core Anti-rotación", equipment: [], measurement: "reps", inSelector: false, status: "metadata" },
  { family: "Handstand", name: "Handstand", equipment: ["bodyweight"], measurement: "time", inSelector: true, status: "historial" },
  { family: "Handstand", name: "Handstand en Paralelas", equipment: ["bodyweight"], measurement: "time", inSelector: true, status: "historial" },
  { family: "Handstand", name: "Handstand — Progresión", equipment: ["bodyweight"], measurement: "time", inSelector: false, status: "metadata" },
  { family: "Front Lever", name: "Front Lever Tuck", equipment: ["bodyweight"], measurement: "time", inSelector: true, status: "historial" },
  { family: "Front Lever", name: "Front Lever Advanced Tuck", equipment: ["bodyweight"], measurement: "time", inSelector: true, status: "historial" },
  { family: "Front Lever", name: "Front Lever One Leg", equipment: ["bodyweight"], measurement: "time", inSelector: true, status: "nueva" },
  { family: "Front Lever", name: "Front Lever Full", equipment: ["bodyweight"], measurement: "time", inSelector: true, status: "nueva" },
  { family: "Front Lever", name: "Front Lever con Ayuda", equipment: ["bodyweight"], measurement: "time", inSelector: true, status: "nueva" },
  { family: "Manguito Rotador", name: "Manguito Rotador", equipment: ["cable", "dumbbell", "band"], unilateral: true, measurement: "reps", inSelector: false, status: "historial" },
  { family: "Manguito Rotador", name: "Rotación Interna", equipment: ["cable", "band", "dumbbell"], unilateral: true, measurement: "reps", inSelector: true, status: "historial" },
  { family: "Manguito Rotador", name: "Rotación Externa", equipment: ["cable", "band", "dumbbell"], unilateral: true, measurement: "reps", inSelector: true, status: "historial" },
  { family: "Muñeca", name: "Extensión de Muñeca", equipment: ["dumbbell", "barbell", "cable"], unilateral: true, measurement: "reps", inSelector: true, status: "historial" },
  { family: "Muñeca", name: "Flexión de Muñeca", equipment: ["dumbbell", "barbell", "cable"], unilateral: true, measurement: "reps", inSelector: true, status: "historial" },
  { family: "Cardio", name: "Cardio (sin especificar)", equipment: [], measurement: "time", inSelector: false, status: "historial" },
  { family: "Cardio", name: "Bicicleta", equipment: ["machine"], measurement: "time", inSelector: true, status: "historial" },
  { family: "Cardio", name: "Trotadora", equipment: ["machine"], measurement: "time", inSelector: true, status: "nueva" },
  { family: "Cardio", name: "Escalera", equipment: ["machine"], measurement: "time", inSelector: true, status: "nueva" },
  { family: "Cardio", name: "Elíptica", equipment: ["machine"], measurement: "time", inSelector: true, status: "nueva" },
  { family: "Curl de Bíceps", name: "Curl Predicador", equipment: ["barbell", "dumbbell", "machine"], measurement: "reps", inSelector: true, status: "nueva" },
  { family: "Core", name: "Crunch Abdominal", equipment: ["bodyweight", "cable", "machine"], measurement: "reps", inSelector: true, status: "nueva" },
  { family: "Pull-over", name: "Pull-over con Polea", equipment: ["cable"], measurement: "reps", inSelector: true, status: "nueva" },
].map(Object.freeze));

// Muscle group of each FAMILY (ids of MUSCLE_GROUP_OPTIONS). It is only a DEFAULT: it preloads the
// group when creating an exercise of the family and classifies it in the selector's muscle tabs
// when the exercise has no group of its own. An exercise's own muscleGroup (metadata) always wins.
export const FAMILY_GROUP = Object.freeze({
  // Piernas
  'Sentadilla': 'legs', 'Prensa': 'legs', 'Peso Muerto': 'legs', 'RDL': 'legs', 'Hip Thrust': 'legs',
  'Split Squat': 'legs', 'Curl Femoral': 'legs', 'Extensión de Cuádriceps': 'legs', 'Abducción': 'legs',
  'Gemelos': 'legs', 'Tibial Anterior': 'legs',
  // Pecho
  'Press Banca': 'chest', 'Press Inclinado': 'chest', 'Flexiones': 'chest', 'Flexiones Declinadas': 'chest', 'Aperturas': 'chest',
  // Espalda
  'Dominadas': 'back', 'Muscle-Up': 'back', 'Jalón': 'back', 'Remo': 'back', 'Pull-over': 'back', 'Front Lever': 'back',
  // Hombros
  'Press Militar': 'shoulders', 'Elevaciones Laterales': 'shoulders', 'Elevaciones Frontales': 'shoulders', 'Facepull': 'shoulders',
  'Pájaros': 'shoulders', 'Encogimientos': 'shoulders', 'Manguito Rotador': 'shoulders', 'Handstand': 'shoulders',
  // Brazos
  'Curl de Bíceps': 'arms', 'Extensión de Tríceps': 'arms', 'Muñeca': 'arms',
  // Core / Cardio
  'Core': 'core', 'Cardio': 'cardio',
});
const familyGroupByKey = new Map(Object.entries(FAMILY_GROUP).map(([f, g]) => [normalizeExerciseName(f), g]));
// Default muscle group of a family (by family name), or undefined.
export const familyGroup = (family) => familyGroupByKey.get(normalizeExerciseName(family));
// Every family name of the table (35).
export const FAMILY_NAMES = Object.freeze([...new Set(FAMILY_TABLE.map(r => r.family))]);

// Names taken OUT of the selector (hardcoded catalogue + any custom row with the same name):
//  - the 7 old ones: Press Banca Inclinado, Remo en punta / Remo en Punta (one identity), Curl
//    Femoral, Extensiones de Cuádriceps, Cruce de Poleas, Plancha Abdominal;
//  - 6 duplicates of table variants: Aperturas de Pecho, Peso Muerto Rumano, Pájaros (Elevaciones
//    Posteriores), Encogimientos de Hombros, Curl Martillo, Elevación de Piernas;
//  - Press Francés (= Rompecráneos) and Fondos en Paralelas (the athlete does not do dips).
// Only the selector: the history keeps whatever it has.
export const SELECTOR_REMOVED_NAMES = Object.freeze([
  'Press Banca Inclinado', 'Remo en punta', 'Remo en Punta', 'Curl Femoral', 'Extensiones de Cuádriceps',
  'Cruce de Poleas', 'Plancha Abdominal',
  'Aperturas de Pecho', 'Peso Muerto Rumano', 'Pájaros (Elevaciones Posteriores)', 'Encogimientos de Hombros',
  'Curl Martillo', 'Elevación de Piernas',
  'Press Francés', 'Fondos en Paralelas',
]);

const norm = normalizeExerciseName;
const byName = new Map(FAMILY_TABLE.map(r => [norm(r.name), r]));
const removed = new Set(SELECTOR_REMOVED_NAMES.map(norm));

// The table row of a variant, or undefined.
export const getFamilyEntry = (name) => byName.get(norm(name));
// Family name according to the table only (null if the name is not in it).
export const tableFamilyOf = (name) => getFamilyEntry(name)?.family ?? null;
// Every variant of a family (by family name, accent/case insensitive).
export const familyVariants = (family) => FAMILY_TABLE.filter(r => norm(r.family) === norm(family));
// Variants that show up in the selector.
export const SELECTOR_TABLE_NAMES = Object.freeze(FAMILY_TABLE.filter(r => r.inSelector).map(r => r.name));
// Names that must NOT appear in the selector (hidden table rows + the removed ones).
export const isHiddenFromSelector = (name) => {
  const e = byName.get(norm(name));
  return (e ? !e.inSelector : false) || removed.has(norm(name));
};
// Implements a variant offers, as EQUIPMENT_TYPES ids ([] when none declared).
// DISPLAY only: the table's spelling of an exercise when the name is the same variant (normalized), else the
// name as it is. Never used to store or to group anything.
export const canonicalExerciseName = (name) => getFamilyEntry(name)?.name ?? name;

// Unilateral spec of a table variant: true (always), [implements] (only with those) or false (bilateral).
export const tableUnilateralOf = (name) => {
  const u = getFamilyEntry(name)?.unilateral;
  return Array.isArray(u) ? [...u] : (u === true);
};
export const offeredEquipment = (name) => [...(getFamilyEntry(name)?.equipment ?? [])];
