// Constructores de datos SINTÉTICOS para los tests (nada viene de un backup real).
// Las fechas son inventadas y se escriben con zona explícita para no depender del TZ.

export const ex = (name, equipment, extra = {}) => ({
  name,
  ...(equipment ? { equipment } : {}),
  sets: [],
  ...extra,
});

export const session = (completedAt, exercises, extra = {}) => ({
  id: `s-${completedAt}`,
  completedAt,
  exercises,
  ...extra,
});

// Escribe la metadata de un ejercicio tal como la dejaría la app (localStorage, clave de la app).
import { saveExerciseMeta } from '../../src/constants/exerciseMetadata.js';
export const setMeta = (name, data) => saveExerciseMeta(name, data);
export const setMeasurementFor = (name, value) => saveExerciseMeta(name, { measurement: value });

// Arma una rutina en el formato del Contrato §1/§3/§4 para el parser.
//   routineMd({ exercises: [exBlock(...)] })
export const exBlock = ({ name, bullets = [], rows = [] }) => {
  const head = `# EJERCICIO: ${name}\n${bullets.map((b) => `- ${b}`).join('\n')}`;
  const table = rows.length
    ? `\n\n| Set | Tipo | Peso | Reps | RPE | Descanso |\n|-----|------|------|------|-----|----------|\n${rows
        .map((r, i) => `| ${i + 1} | ${r.join(' | ')} |`)
        .join('\n')}\n`
    : '\n';
  return head + table;
};

export const routineMd = ({ header = 'nombre: LEGS\nfecha: 2026-01-05', exercises = [] } = {}) =>
  `---\n${header}\n---\n\n${exercises.join('\n')}`;

// Un ejercicio mínimo válido (con equipo y descanso) para aislar lo que cada test mira.
export const simpleEx = ({ name = 'Press Banca', bullets, rows } = {}) =>
  exBlock({
    name,
    bullets: bullets ?? ['equipo: barbell', 'descanso: 90s'],
    rows: rows ?? [['normal', '100', '5', '8', '90s']],
  });
