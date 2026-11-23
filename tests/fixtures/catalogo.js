// Catálogo v2.0.1 (Contrato v1.8.3, sección 8), transcrito a mano. Es la FUENTE de los tests de
// tabla de familias y de matcher: si el código se aparta de estas filas, el test falla.
// Implementos en español como en 8.3; "·tiempo" = ejercicio medido en tiempo.

export const ES_TO_ID = {
  barra: 'barbell', multipower: 'smith', mancuerna: 'dumbbell', kettlebell: 'kettlebell',
  'máquina': 'machine', polea: 'cable', landmine: 'landmine', banda: 'band', 'peso corporal': 'bodyweight',
};

// [familia, variante, implementos (en orden), unilateral, tiempo]
//   unilateral: '' (bilateral) | 'sí' | 'con polea' (solo con ese implemento)
const T = true;
export const CATALOGO_83 = [
  // Piernas
  ['Sentadilla', 'Sentadilla', 'barra,multipower'],
  ['Sentadilla', 'Sentadilla Frontal', 'barra,multipower'],
  ['Sentadilla', 'Sentadilla Goblet', 'mancuerna,kettlebell'],
  ['Sentadilla', 'Sentadilla Hack', 'máquina'],
  ['Sentadilla', 'Sentadilla Péndulo', 'máquina'],
  ['Sentadilla', 'V Squat', 'máquina'],
  ['Sentadilla', 'Sissy Squat', 'peso corporal,máquina'],
  ['Split Squat', 'Sentadilla Búlgara', 'mancuerna,barra,multipower,peso corporal', 'sí'],
  ['Prensa', 'Prensa de Piernas', 'máquina'],
  ['Prensa', 'Prensa de Piernas Unilateral', 'máquina', 'sí'],
  ['Peso Muerto', 'Peso Muerto', 'barra'],
  ['RDL', 'RDL', 'barra,mancuerna,multipower'],
  ['RDL', 'Buenos Días', 'barra,multipower'],
  ['RDL', 'Buenos Días en Hack', 'máquina'],
  ['RDL', 'Buenos Días en V Squat', 'máquina'],
  ['RDL', 'RDL en Belt Squat', 'máquina'],
  ['Hip Thrust', 'Hip Thrust', 'barra,máquina,mancuerna,peso corporal'],
  ['Curl Femoral', 'Curl Femoral Sentado', 'máquina'],
  ['Curl Femoral', 'Curl Femoral Acostado', 'máquina'],
  ['Curl Femoral', 'Nordic Curl', 'peso corporal'],
  ['Extensión de Cuádriceps', 'Extensión de Cuádriceps', 'máquina'],
  ['Abducción', 'Abducción de Piernas', 'máquina'],
  ['Gemelos', 'Elevación de Gemelos', 'máquina'],
  ['Tibial Anterior', 'Tibial Anterior', ''],
  // Pecho
  ['Press Banca', 'Press Banca', 'barra,mancuerna,multipower'],
  ['Press Banca', 'Press Banca con Pausa', 'barra'],
  ['Press Banca', 'Press Banca Agarre Cerrado', 'barra'],
  ['Press Inclinado', 'Press Inclinado', 'barra,mancuerna,multipower'],
  ['Aperturas', 'Aperturas', 'polea,mancuerna'],
  ['Flexiones', 'Push-Ups', 'peso corporal'],
  ['Flexiones', 'Push-Ups en Paralelas', 'peso corporal'],
  ['Flexiones Declinadas', 'Decline Push-Ups', 'peso corporal'],
  ['Flexiones Declinadas', 'Decline Push-Ups en Paralelas', 'peso corporal'],
  // Espalda
  ['Dominadas', 'Dominadas', 'peso corporal'],
  ['Muscle-Up', 'Muscle-Up', 'peso corporal'],
  ['Jalón', 'Jalón al Pecho', 'máquina,polea'],
  ['Jalón', 'Jalón a una mano', 'polea,máquina', 'sí'],
  ['Remo', 'Remo con Barra', 'barra'],
  ['Remo', 'Remo Mancuerna', 'mancuerna', 'sí'],
  ['Remo', 'Remo en Polea', 'polea'],
  ['Remo', 'Remo Landmine', 'landmine', 'sí'],
  ['Remo', 'Remo en T con apoyo', 'máquina,landmine'],
  ['Pull-over', 'Pull-over con Polea', 'polea'],
  ['Front Lever', 'Front Lever Tuck', 'peso corporal', '', T],
  ['Front Lever', 'Front Lever Advanced Tuck', 'peso corporal', '', T],
  ['Front Lever', 'Front Lever One Leg', 'peso corporal', '', T],
  ['Front Lever', 'Front Lever Full', 'peso corporal', '', T],
  ['Front Lever', 'Front Lever con Ayuda', 'peso corporal', '', T],
  // Hombros
  ['Press Militar', 'Press Militar', 'barra,mancuerna'],
  ['Press Militar', 'Press Militar Sentado', 'barra,mancuerna,máquina'],
  ['Elevaciones Laterales', 'Elevaciones Laterales', 'mancuerna,polea,máquina', 'con polea'],
  ['Elevaciones Frontales', 'Reverse Front Fly', 'polea', 'sí'],
  ['Pájaros', 'Pájaros', 'polea,mancuerna', 'con polea'],
  ['Facepull', 'Facepull', 'polea'],
  ['Encogimientos', 'Encogimientos', 'máquina,barra,mancuerna'],
  ['Manguito Rotador', 'Rotación Externa', 'polea,banda,mancuerna', 'sí'],
  ['Manguito Rotador', 'Rotación Interna', 'polea,banda,mancuerna', 'sí'],
  ['Handstand', 'Handstand', 'peso corporal', '', T],
  ['Handstand', 'Handstand en Paralelas', 'peso corporal', '', T],
  // Brazos
  ['Curl de Bíceps', 'Curl de Bíceps', 'barra,mancuerna,polea', 'con polea'],
  ['Curl de Bíceps', 'Curl Bayesiano', 'polea', 'sí'],
  ['Curl de Bíceps', 'Hammer Curl', 'mancuerna,polea', 'con polea'],
  ['Curl de Bíceps', 'Curl Predicador', 'barra,mancuerna,máquina'],
  ['Extensión de Tríceps', 'Extensión de Tríceps', 'polea', 'con polea'],
  ['Extensión de Tríceps', 'Extensión Tríceps Katana', 'polea', 'sí'],
  ['Extensión de Tríceps', 'Rompecráneos', 'barra,mancuerna'],
  ['Muñeca', 'Extensión de Muñeca', 'mancuerna,barra,polea', 'sí'],
  ['Muñeca', 'Flexión de Muñeca', 'mancuerna,barra,polea', 'sí'],
  // Core
  ['Core', 'Plancha', 'peso corporal', '', T],
  ['Core', 'Plancha Lateral', 'peso corporal', 'sí', T],
  ['Core', 'Crunch Abdominal', 'peso corporal,polea,máquina'],
  ['Core', 'Knee Raises', 'peso corporal'],
  ['Core', 'Leg Raises', 'peso corporal'],
  ['Core', 'Ab Wheel', 'peso corporal'],
  ['Core', 'Dragon Flag', 'peso corporal'],
  // Cardio
  ['Cardio', 'Bicicleta', 'máquina', '', T],
  ['Cardio', 'Trotadora', 'máquina', '', T],
  ['Cardio', 'Elíptica', 'máquina', '', T],
  ['Cardio', 'Escalera', 'máquina', '', T],
];

// Grupo muscular de cada familia, según el encabezado de sección de 8.3.
export const GRUPO_POR_FAMILIA = {
  legs: ['Sentadilla', 'Split Squat', 'Prensa', 'Peso Muerto', 'RDL', 'Hip Thrust', 'Curl Femoral',
    'Extensión de Cuádriceps', 'Abducción', 'Gemelos', 'Tibial Anterior'],
  chest: ['Press Banca', 'Press Inclinado', 'Aperturas', 'Flexiones', 'Flexiones Declinadas'],
  back: ['Dominadas', 'Muscle-Up', 'Jalón', 'Remo', 'Pull-over', 'Front Lever'],
  shoulders: ['Press Militar', 'Elevaciones Laterales', 'Elevaciones Frontales', 'Pájaros', 'Facepull',
    'Encogimientos', 'Manguito Rotador', 'Handstand'],
  arms: ['Curl de Bíceps', 'Extensión de Tríceps', 'Muñeca'],
  core: ['Core'],
  cardio: ['Cardio'],
};

// 8.4: nombre viejo -> [nombre nuevo, equipo]. Solo las filas con UN destino claro; las filas
// especiales (nombres de familia, prefijos de rol, protocolos) se prueban aparte.
export const EQUIVALENCIAS_84 = [
  ['Flexión de Piernas', 'Curl Femoral Sentado', 'machine'],
  ['Extensiones de Cuádriceps', 'Extensión de Cuádriceps', 'machine'],
  ['Press Banca Inclinado', 'Press Inclinado', 'barbell'],
  ['Press Inclinado Mancuernas', 'Press Inclinado', 'dumbbell'],
  ['Press banca agarre cerado', 'Press Banca Agarre Cerrado', 'barbell'],
  ['Press Militar Estricto', 'Press Militar', 'barbell'],
  ['Cruce de Poleas', 'Aperturas', 'cable'],
  ['Push-Ups Pies Elevados', 'Decline Push-Ups', 'bodyweight'],
  ['Push-Ups Pies Elevados + Paralelas', 'Decline Push-Ups en Paralelas', 'bodyweight'],
  ['Jalón en Polea a una mano', 'Jalón a una mano', 'cable'],
  ['Jalon al pecho unilateral', 'Jalón a una mano', 'cable'],
  ['Remo en Punta', 'Remo Landmine', 'landmine'],
  ['Remo con Landmine', 'Remo Landmine', 'landmine'],
  ['Remo Polea / Landmine', 'Remo en Polea', 'cable'],
  ['Remo en Polea / Landmine', 'Remo en Polea', 'cable'],
  ['Curl de Bíceps con Barra', 'Curl de Bíceps', 'barbell'],
  ['Curl de bicep con barra', 'Curl de Bíceps', 'barbell'],
  ['Curl de Bíceps en Polea', 'Curl de Bíceps', 'cable'],
  ['Curl de Bíceps Bayesiano', 'Curl Bayesiano', 'cable'],
  ['Extensión de Tríceps con Mancuerna', 'Rompecráneos', 'dumbbell'],
  ['Elevaciones laterales con polea', 'Elevaciones Laterales', 'cable'],
  ['Pájaros rear delts', 'Pájaros', 'cable'],
  ['Encogimientos de Hombros', 'Encogimientos', 'machine'],
  ['Extensión de muñecas', 'Extensión de Muñeca', 'cable'],
  ['Curl de Muñeca', 'Flexión de Muñeca', 'cable'],
  ['Plancha Abdominal', 'Plancha', 'bodyweight'],
  ['Core Anti-extensión', 'Plancha', 'bodyweight'],
  ['Tuck Front Lever', 'Front Lever Tuck', 'bodyweight'],
];

// 8.4: filas que son el MISMO nombre del Catálogo salvo mayúsculas/tildes -> identidad exacta (8.1).
export const SOLO_MAYUSCULAS_84 = [
  ['Curl femoral acostado', 'Curl Femoral Acostado'],
  ['Prensa de piernas unilateral', 'Prensa de Piernas Unilateral'],
  ['Abducción de piernas', 'Abducción de Piernas'],
  ['Remo mancuerna', 'Remo Mancuerna'],
  ['Hammer curl', 'Hammer Curl'],
  ['Extensión tríceps katana', 'Extensión Tríceps Katana'],
];
