// PULL_UP_SPLIT is a sentinel: weight>0 → "Lastradas", weight===0 → normal
export const PULL_UP_SPLIT_MARKER = 'PULL_UP_SPLIT';

// Exercises that become "Lastradas" when weight > 0
const WEIGHTED_BW_EXERCISES = new Set([
  'Pull Up', 'Chin Up', 'Dip', 'Push Up', 'Muscle Up', 'Ring Dip', 'Ring Pull Up',
]);

export const STRONG_EXERCISE_MAPPING = {
  // ── Barbell ────────────────────────────────────────────────────────────────
  'Deadlift (Barbell)':              { name: 'Peso Muerto',                       equipment: 'barbell' },
  'Deadlift':                        { name: 'Peso Muerto',                       equipment: 'barbell' },
  'Squat (Barbell)':                 { name: 'Sentadilla',                        equipment: 'barbell' },
  'Back Squat (Barbell)':            { name: 'Sentadilla',                        equipment: 'barbell' },
  'Front Squat (Barbell)':           { name: 'Sentadilla Frontal',                equipment: 'barbell' },
  'Bench Press (Barbell)':           { name: 'Press Banca',                       equipment: 'barbell' },
  'Bench Press':                     { name: 'Press Banca',                       equipment: 'barbell' },
  'Incline Bench Press (Barbell)':   { name: 'Press Banca Inclinado',             equipment: 'barbell' },
  'Incline Bench Press':             { name: 'Press Banca Inclinado',             equipment: 'barbell' },
  'Decline Bench Press (Barbell)':   { name: 'Press Banca Declinado',             equipment: 'barbell' },
  'Overhead Press (Barbell)':        { name: 'Press Militar',                     equipment: 'barbell' },
  'Overhead Press':                  { name: 'Press Militar',                     equipment: 'barbell' },
  'OHP (Barbell)':                   { name: 'Press Militar',                     equipment: 'barbell' },
  'Bent Over Row (Barbell)':         { name: 'Remo con Barra',                    equipment: 'barbell' },
  'Barbell Row':                     { name: 'Remo con Barra',                    equipment: 'barbell' },
  'Romanian Deadlift (Barbell)':     { name: 'Peso Muerto Rumano',                equipment: 'barbell' },
  'Romanian Deadlift':               { name: 'Peso Muerto Rumano',                equipment: 'barbell' },
  'RDL (Barbell)':                   { name: 'Peso Muerto Rumano',                equipment: 'barbell' },
  'Hip Thrust (Barbell)':            { name: 'Hip Thrust',                        equipment: 'barbell' },
  'Hip Thrust':                      { name: 'Hip Thrust',                        equipment: 'barbell' },
  'Good Morning (Barbell)':          { name: 'Buenos Días con Barra',             equipment: 'barbell' },
  'Good Morning':                    { name: 'Buenos Días con Barra',             equipment: 'barbell' },
  'Floor Press (Barbell)':           { name: 'Press en Suelo',                    equipment: 'barbell' },
  'Sumo Deadlift (Barbell)':         { name: 'Peso Muerto Sumo',                  equipment: 'barbell' },
  'Sumo Deadlift':                   { name: 'Peso Muerto Sumo',                  equipment: 'barbell' },
  'Pause Squat (Barbell)':           { name: 'Sentadilla con Pausa',              equipment: 'barbell' },
  'Power Clean (Barbell)':           { name: 'Power Clean',                       equipment: 'barbell' },
  'Power Clean':                     { name: 'Power Clean',                       equipment: 'barbell' },
  'Power Snatch (Barbell)':          { name: 'Power Snatch',                      equipment: 'barbell' },
  'Power Snatch':                    { name: 'Power Snatch',                      equipment: 'barbell' },
  'Close Grip Bench Press (Barbell)':{ name: 'Press Banca Agarre Cerrado',        equipment: 'barbell' },
  'Barbell Curl':                    { name: 'Curl de Bíceps con Barra',          equipment: 'barbell' },
  'Bicep Curl (Barbell)':            { name: 'Curl de Bíceps con Barra',          equipment: 'barbell' },
  'Skull Crusher (Barbell)':         { name: 'Rompecráneos',                      equipment: 'barbell' },
  'Tricep Extension (Barbell)':      { name: 'Rompecráneos',                      equipment: 'barbell' },
  'Lunge (Barbell)':                 { name: 'Zancadas con Barra',               equipment: 'barbell' },
  'Split Squat (Barbell)':           { name: 'Sentadilla Dividida con Barra',    equipment: 'barbell' },
  'Pendlay Row':                     { name: 'Remo Pendlay',                      equipment: 'barbell' },
  'Zercher Squat (Barbell)':         { name: 'Sentadilla Zercher',                equipment: 'barbell' },
  'T-Bar Row':                       { name: 'Remo en T',                         equipment: 'barbell' },

  // ── Dumbbell ───────────────────────────────────────────────────────────────
  'Bicep Curl (Dumbbell)':           { name: 'Curl de Bíceps',                   equipment: 'dumbbell' },
  'Dumbbell Curl':                   { name: 'Curl de Bíceps',                   equipment: 'dumbbell' },
  'Hammer Curl (Dumbbell)':          { name: 'Curl Martillo',                    equipment: 'dumbbell' },
  'Hammer Curl':                     { name: 'Curl Martillo',                    equipment: 'dumbbell' },
  'Incline Curl (Dumbbell)':         { name: 'Curl Inclinado con Mancuernas',    equipment: 'dumbbell' },
  'Incline Dumbbell Curl':           { name: 'Curl Inclinado con Mancuernas',    equipment: 'dumbbell' },
  'Concentration Curl (Dumbbell)':   { name: 'Curl Predicador',                  equipment: 'dumbbell' },
  'Concentration Curl':              { name: 'Curl Predicador',                  equipment: 'dumbbell' },
  'Tricep Extension (Dumbbell)':     { name: 'Extensión de Tríceps',             equipment: 'dumbbell' },
  'Overhead Tricep Extension (Dumbbell)': { name: 'Extensión de Tríceps',        equipment: 'dumbbell' },
  'Skull Crusher (Dumbbell)':        { name: 'Rompecráneos con Mancuernas',      equipment: 'dumbbell' },
  'Lateral Raise (Dumbbell)':        { name: 'Elevaciones Laterales',            equipment: 'dumbbell' },
  'Lateral Raise':                   { name: 'Elevaciones Laterales',            equipment: 'dumbbell' },
  'Front Raise (Dumbbell)':          { name: 'Elevaciones Frontales',            equipment: 'dumbbell' },
  'Front Raise':                     { name: 'Elevaciones Frontales',            equipment: 'dumbbell' },
  'Rear Delt Fly (Dumbbell)':        { name: 'Pájaros (Elevaciones Posteriores)',equipment: 'dumbbell' },
  'Rear Delt Fly':                   { name: 'Pájaros (Elevaciones Posteriores)',equipment: 'dumbbell' },
  'Bent Over Lateral Raise (Dumbbell)': { name: 'Pájaros (Elevaciones Posteriores)', equipment: 'dumbbell' },
  'Shoulder Press (Dumbbell)':       { name: 'Press de Hombros con Mancuernas', equipment: 'dumbbell' },
  'Dumbbell Shoulder Press':         { name: 'Press de Hombros con Mancuernas', equipment: 'dumbbell' },
  'Bench Press (Dumbbell)':          { name: 'Press Banca con Mancuernas',       equipment: 'dumbbell' },
  'Dumbbell Bench Press':            { name: 'Press Banca con Mancuernas',       equipment: 'dumbbell' },
  'Incline Bench Press (Dumbbell)':  { name: 'Press Banca Inclinado Mancuernas',equipment: 'dumbbell' },
  'Incline Dumbbell Press':          { name: 'Press Banca Inclinado Mancuernas',equipment: 'dumbbell' },
  'Row (Dumbbell)':                  { name: 'Remo con Mancuerna',               equipment: 'dumbbell' },
  'Dumbbell Row':                    { name: 'Remo con Mancuerna',               equipment: 'dumbbell' },
  'One Arm Row (Dumbbell)':          { name: 'Remo con Mancuerna',               equipment: 'dumbbell' },
  'Goblet Squat (Dumbbell)':         { name: 'Sentadilla Goblet',                equipment: 'dumbbell' },
  'Goblet Squat':                    { name: 'Sentadilla Goblet',                equipment: 'dumbbell' },
  'Romanian Deadlift (Dumbbell)':    { name: 'Peso Muerto Rumano con Mancuernas',equipment: 'dumbbell' },
  'Bulgarian Split Squat (Dumbbell)':{ name: 'Sentadilla Búlgara',               equipment: 'dumbbell' },
  'Bulgarian Split Squat':           { name: 'Sentadilla Búlgara',               equipment: 'dumbbell' },
  'Lunge (Dumbbell)':                { name: 'Zancadas con Mancuernas',          equipment: 'dumbbell' },
  'Lunge':                           { name: 'Zancadas',                         equipment: 'bodyweight' },
  'Fly (Dumbbell)':                  { name: 'Aperturas de Pecho',               equipment: 'dumbbell' },
  'Dumbbell Fly':                    { name: 'Aperturas de Pecho',               equipment: 'dumbbell' },
  'Incline Fly (Dumbbell)':          { name: 'Aperturas Inclinadas',             equipment: 'dumbbell' },
  'Shrug (Dumbbell)':                { name: 'Encogimientos de Hombros',         equipment: 'dumbbell' },
  'Hip Thrust (Dumbbell)':           { name: 'Hip Thrust con Mancuerna',         equipment: 'dumbbell' },
  'Calf Raise (Dumbbell)':           { name: 'Elevación de Gemelos',             equipment: 'dumbbell' },
  'Tricep Kickback (Dumbbell)':      { name: 'Patada de Tríceps',                equipment: 'dumbbell' },
  'Arnold Press (Dumbbell)':         { name: 'Press Arnold',                     equipment: 'dumbbell' },
  'Step Up (Dumbbell)':              { name: 'Escalón con Mancuernas',           equipment: 'dumbbell' },

  // ── Cable ──────────────────────────────────────────────────────────────────
  'Seated Row (Cable)':              { name: 'Remo Sentado en Polea',            equipment: 'cable' },
  'Cable Row':                       { name: 'Remo Sentado en Polea',            equipment: 'cable' },
  'Low Row (Cable)':                 { name: 'Remo Sentado en Polea',            equipment: 'cable' },
  'Lat Pulldown (Cable)':            { name: 'Jalón al Pecho',                   equipment: 'cable' },
  'Lat Pulldown':                    { name: 'Jalón al Pecho',                   equipment: 'cable' },
  'Tricep Extension (Cable)':        { name: 'Extensión de Tríceps en Polea',    equipment: 'cable' },
  'Tricep Pushdown (Cable)':         { name: 'Extensión de Tríceps en Polea',    equipment: 'cable' },
  'Tricep Pushdown':                 { name: 'Extensión de Tríceps en Polea',    equipment: 'cable' },
  'Overhead Tricep Extension (Cable)': { name: 'Extensión de Tríceps sobre Cabeza', equipment: 'cable' },
  'Face Pull (Cable)':               { name: 'Face Pull',                        equipment: 'cable' },
  'Face Pull':                       { name: 'Face Pull',                        equipment: 'cable' },
  'Cable Crossover':                 { name: 'Cruce de Poleas',                  equipment: 'cable' },
  'Fly (Cable)':                     { name: 'Cruce de Poleas',                  equipment: 'cable' },
  'Cable Curl':                      { name: 'Curl en Polea',                    equipment: 'cable' },
  'Bicep Curl (Cable)':              { name: 'Curl en Polea',                    equipment: 'cable' },
  'Cable Lateral Raise':             { name: 'Elevaciones Laterales en Polea',   equipment: 'cable' },
  'Lateral Raise (Cable)':           { name: 'Elevaciones Laterales en Polea',   equipment: 'cable' },
  'Pull Through (Cable)':            { name: 'Pull-Through en Polea',            equipment: 'cable' },
  'Pull Through':                    { name: 'Pull-Through en Polea',            equipment: 'cable' },
  'Wood Chop (Cable)':               { name: 'Leñador en Polea',                 equipment: 'cable' },
  'Cable Crunch':                    { name: 'Crunch en Polea',                  equipment: 'cable' },
  'Crunch (Cable)':                  { name: 'Crunch en Polea',                  equipment: 'cable' },
  'Pull-over (Cable)':               { name: 'Pull-over con Polea',              equipment: 'cable' },
  'Straight Arm Pulldown (Cable)':   { name: 'Pull-over con Polea',              equipment: 'cable' },
  'Rope Pushdown (Cable)':           { name: 'Extensión de Tríceps en Polea',    equipment: 'cable' },
  'Reverse Fly (Cable)':             { name: 'Pájaros en Polea',                 equipment: 'cable' },
  'Upright Row (Cable)':             { name: 'Remo al Mentón en Polea',          equipment: 'cable' },
  'Hip Abduction (Cable)':           { name: 'Abducción de Cadera en Polea',     equipment: 'cable' },

  // ── Machine ────────────────────────────────────────────────────────────────
  'Leg Press (Machine)':             { name: 'Prensa de Piernas',                equipment: 'machine' },
  'Leg Press':                       { name: 'Prensa de Piernas',                equipment: 'machine' },
  'Leg Curl (Machine)':              { name: 'Curl Femoral',                     equipment: 'machine' },
  'Leg Curl':                        { name: 'Curl Femoral',                     equipment: 'machine' },
  'Seated Leg Curl (Machine)':       { name: 'Curl Femoral',                     equipment: 'machine' },
  'Lying Leg Curl (Machine)':        { name: 'Curl Femoral Tumbado',             equipment: 'machine' },
  'Leg Extension (Machine)':         { name: 'Extensiones de Cuádriceps',        equipment: 'machine' },
  'Leg Extension':                   { name: 'Extensiones de Cuádriceps',        equipment: 'machine' },
  'Calf Raise (Machine)':            { name: 'Elevación de Gemelos',             equipment: 'machine' },
  'Standing Calf Raise (Machine)':   { name: 'Elevación de Gemelos',             equipment: 'machine' },
  'Seated Calf Raise (Machine)':     { name: 'Elevación de Gemelos Sentado',     equipment: 'machine' },
  'Hack Squat (Machine)':            { name: 'Sentadilla Hack',                  equipment: 'machine' },
  'Hack Squat':                      { name: 'Sentadilla Hack',                  equipment: 'machine' },
  'Smith Machine Squat':             { name: 'Sentadilla en Máquina Smith',      equipment: 'machine' },
  'Pec Deck (Machine)':              { name: 'Aperturas de Pecho',               equipment: 'machine' },
  'Pec Deck':                        { name: 'Aperturas de Pecho',               equipment: 'machine' },
  'Chest Press (Machine)':           { name: 'Press Pecho en Máquina',           equipment: 'machine' },
  'Chest Fly (Machine)':             { name: 'Aperturas de Pecho',               equipment: 'machine' },
  'Shoulder Press (Machine)':        { name: 'Press de Hombros en Máquina',      equipment: 'machine' },
  'Lat Pulldown (Machine)':          { name: 'Jalón al Pecho en Máquina',        equipment: 'machine' },
  'Row (Machine)':                   { name: 'Remo en Máquina',                  equipment: 'machine' },
  'Seated Row (Machine)':            { name: 'Remo en Máquina',                  equipment: 'machine' },
  'Hip Abduction (Machine)':         { name: 'Abducción de Cadera',              equipment: 'machine' },
  'Hip Adduction (Machine)':         { name: 'Aducción de Cadera',               equipment: 'machine' },
  'Glute Kickback (Machine)':        { name: 'Patada de Glúteo en Máquina',      equipment: 'machine' },
  'Shrug (Machine)':                 { name: 'Encogimientos de Hombros',         equipment: 'machine' },
  'Back Extension (Machine)':        { name: 'Extensión de Espalda',             equipment: 'machine' },
  'Preacher Curl (Machine)':         { name: 'Curl Predicador en Máquina',       equipment: 'machine' },
  'Tricep Extension (Machine)':      { name: 'Extensión de Tríceps en Máquina',  equipment: 'machine' },

  // ── Bodyweight ─────────────────────────────────────────────────────────────
  'Push Up':                         PULL_UP_SPLIT_MARKER,
  'Pull Up':                         PULL_UP_SPLIT_MARKER,
  'Chin Up':                         PULL_UP_SPLIT_MARKER,
  'Dip':                             PULL_UP_SPLIT_MARKER,
  'Muscle Up':                       PULL_UP_SPLIT_MARKER,
  'Ring Dip':                        PULL_UP_SPLIT_MARKER,
  'Ring Pull Up':                    PULL_UP_SPLIT_MARKER,
  'Sit Up':                          { name: 'Crunch Abdominal',                 equipment: 'bodyweight' },
  'Crunch':                          { name: 'Crunch Abdominal',                 equipment: 'bodyweight' },
  'Plank':                           { name: 'Plancha Abdominal',                equipment: 'bodyweight' },
  'Mountain Climber':                { name: 'Escalador (Mountain Climber)',      equipment: 'bodyweight' },
  'Burpee':                          { name: 'Burpee',                           equipment: 'bodyweight' },
  'Box Jump':                        { name: 'Salto al Cajón',                   equipment: 'bodyweight' },
  'Jump Squat':                      { name: 'Sentadilla con Salto',             equipment: 'bodyweight' },
  'Hanging Leg Raise':               { name: 'Elevación de Piernas Colgado',     equipment: 'bodyweight' },
  'Hanging Knee Raise':              { name: 'Elevación de Rodillas Colgado',    equipment: 'bodyweight' },
  'Leg Raise':                       { name: 'Elevación de Piernas',             equipment: 'bodyweight' },
  'Glute Bridge':                    { name: 'Puente de Glúteos',                equipment: 'bodyweight' },
  'Back Extension (Bodyweight)':     { name: 'Extensión de Espalda',             equipment: 'bodyweight' },
  'Inverted Row':                    { name: 'Remo Invertido',                   equipment: 'bodyweight' },
  'Pike Push Up':                    { name: 'Flexión Pike',                     equipment: 'bodyweight' },
  'Diamond Push Up':                 { name: 'Flexión Diamante',                 equipment: 'bodyweight' },
  'Wide Push Up':                    { name: 'Flexión Amplia',                   equipment: 'bodyweight' },

  // ── Cardio / Otros ─────────────────────────────────────────────────────────
  'Running (Treadmill)':             { name: 'Carrera (Cinta)',                  equipment: 'cardio' },
  'Running':                         { name: 'Carrera',                          equipment: 'cardio' },
  'Cycling (Bike)':                  { name: 'Ciclismo (Bicicleta)',             equipment: 'cardio' },
  'Cycling':                         { name: 'Ciclismo',                         equipment: 'cardio' },
  'Rowing (Ergometer)':              { name: 'Remo (Ergómetro)',                 equipment: 'cardio' },
  'Jump Rope':                       { name: 'Saltar la Cuerda',                 equipment: 'cardio' },
  'Elliptical':                      { name: 'Elíptica',                         equipment: 'cardio' },
  'Stair Climber':                   { name: 'Escaladora',                       equipment: 'cardio' },
  'Sled Push':                       { name: 'Empuje de Trineo',                 equipment: 'other' },
  'Sled Pull':                       { name: 'Tirón de Trineo',                  equipment: 'other' },
  'Farmers Walk':                    { name: 'Caminata del Granjero',            equipment: 'other' },
  'Farmers Carry':                   { name: 'Caminata del Granjero',            equipment: 'other' },
  'Battle Ropes':                    { name: 'Cuerdas de Batalla',               equipment: 'other' },
  'Kettlebell Swing':                { name: 'Swing con Pesa Rusa',              equipment: 'other' },
  'Turkish Get Up':                  { name: 'Turkish Get Up',                   equipment: 'other' },
};

// Weighted-bodyweight split logic
function resolveSplitExercise(strongName, weight) {
  const splits = {
    'Push Up':     { loaded: 'Flexiones Lastradas',    normal: 'Flexiones'          },
    'Pull Up':     { loaded: 'Dominadas Lastradas',    normal: 'Dominadas'          },
    'Chin Up':     { loaded: 'Chin Up Lastrado',       normal: 'Chin Up'            },
    'Dip':         { loaded: 'Fondos Lastrados',       normal: 'Fondos en Paralelas'},
    'Muscle Up':   { loaded: 'Muscle Up Lastrado',     normal: 'Muscle Up'          },
    'Ring Dip':    { loaded: 'Fondos en Anillas Lastrados', normal: 'Fondos en Anillas' },
    'Ring Pull Up':{ loaded: 'Dominadas en Anillas Lastradas', normal: 'Dominadas en Anillas' },
  };
  const entry = splits[strongName];
  if (!entry) return { name: strongName, equipment: 'bodyweight' };
  const name = weight > 0 ? entry.loaded : entry.normal;
  return { name, equipment: 'bodyweight' };
}

/**
 * @param {string} strongName
 * @param {number} weight
 * @returns {{ name: string, equipment: string, originalName: string }}
 */
export function mapStrongExercise(strongName, weight = 0) {
  const mapping = STRONG_EXERCISE_MAPPING[strongName];

  if (!mapping) {
    return { name: strongName, equipment: 'other', originalName: strongName };
  }

  if (mapping === PULL_UP_SPLIT_MARKER) {
    const resolved = resolveSplitExercise(strongName, weight);
    return { ...resolved, originalName: strongName };
  }

  return { ...mapping, originalName: strongName };
}

/**
 * Returns Strong exercise names not present in the dictionary.
 * @param {object[]} parsedRows
 * @returns {{ exerciseRaw: string, count: number }[]}
 */
export function getUnknownExercises(parsedRows) {
  const counts = {};
  for (const row of parsedRows) {
    const name = row.exerciseRaw;
    if (!STRONG_EXERCISE_MAPPING[name]) {
      counts[name] = (counts[name] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([exerciseRaw, count]) => ({ exerciseRaw, count }))
    .sort((a, b) => b.count - a.count);
}
