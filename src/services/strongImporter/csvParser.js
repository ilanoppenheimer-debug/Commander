const EXPECTED_HEADERS = [
  'Workout #',
  'Date',
  'Workout Name',
  'Duration (sec)',
  'Exercise Name',
  'Set Order',
  'Weight (kg)',
  'Reps',
  'RPE',
  'Distance (meters)',
  'Seconds',
  'Notes',
  'Workout Notes',
];

function unquote(str) {
  const s = str.trim();
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  return s;
}

// Split a CSV line by ';' respecting quoted fields (no embedded newlines in Strong CSVs)
function splitLine(line) {
  const fields = [];
  let inQuote = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ';' && !inQuote) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * @param {string} csvText
 * @returns {{ rows: object[], workoutCount: number, setCount: number }}
 */
export function parseStrongCSV(csvText) {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Strip BOM if present
  if (lines[0].charCodeAt(0) === 0xfeff) lines[0] = lines[0].slice(1);

  if (lines.length < 2) throw new Error('CSV vacío o sin datos');

  const headerFields = splitLine(lines[0]).map(unquote);

  // Validate all expected headers are present
  const missing = EXPECTED_HEADERS.filter(h => !headerFields.includes(h));
  if (missing.length > 0) {
    throw new Error(`Headers no reconocidos o faltantes: ${missing.join(', ')}. ¿Es un CSV de Strong?`);
  }

  // Build index map so order doesn't matter
  const idx = {};
  EXPECTED_HEADERS.forEach(h => { idx[h] = headerFields.indexOf(h); });

  const rows = [];
  const workoutIds = new Set();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = splitLine(line);
    if (fields.length < headerFields.length) continue;

    const get = (h) => unquote(fields[idx[h]] ?? '');

    const workoutId  = get('Workout #');
    const repsRaw    = get('Reps');
    const weightRaw  = get('Weight (kg)');
    const rpeRaw     = get('RPE');
    const setOrderRaw = get('Set Order');

    const reps   = repsRaw   ? Math.round(parseFloat(repsRaw))   : 0;
    const weight = weightRaw ? parseFloat(weightRaw)             : 0;
    const rpe    = rpeRaw    ? parseFloat(rpeRaw)                : null;
    const setOrder = setOrderRaw ? parseInt(setOrderRaw, 10)     : 0;

    workoutIds.add(workoutId);

    rows.push({
      workoutId,
      date:          get('Date'),
      workoutName:   get('Workout Name'),
      durationSec:   get('Duration (sec)') ? parseInt(get('Duration (sec)'), 10) : 0,
      exerciseRaw:   get('Exercise Name'),
      setOrder,
      weight:        isNaN(weight) ? 0 : weight,
      reps:          isNaN(reps)   ? 0 : reps,
      rpe:           (rpe !== null && isNaN(rpe)) ? null : rpe,
      distance:      get('Distance (meters)') ? parseFloat(get('Distance (meters)')) : 0,
      seconds:       get('Seconds') ? parseInt(get('Seconds'), 10) : 0,
      notes:         get('Notes'),
      workoutNotes:  get('Workout Notes'),
    });
  }

  if (rows.length === 0) throw new Error('No se encontraron filas de datos en el CSV');

  return { rows, workoutCount: workoutIds.size, setCount: rows.length };
}
