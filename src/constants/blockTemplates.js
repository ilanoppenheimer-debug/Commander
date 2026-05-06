export const BLOCK_TYPES = ['peaking', 'accumulation', 'intensification', 'hypertrophy', 'deload', 'maintenance', 'conditioning', 'custom'];

export const TAG_OPTIONS = ['main_lift', 'secondary', 'accessory', 'isolation', 'conditioning'];

export const TAG_LABELS = {
  main_lift:    'Main Lift',
  secondary:    'Secondary',
  accessory:    'Accessory',
  isolation:    'Isolation',
  conditioning: 'Conditioning',
};

export const TAG_DESCRIPTIONS = {
  main_lift:    'Lift principal: sentadilla, banca, peso muerto, press militar',
  secondary:    'Variantes pesadas: front squat, banca pausa, deadlift déficit',
  accessory:    'Apoyos compuestos: prensa, dominadas, banca inclinada',
  isolation:    'Aislación: curl, tríceps, gemelo, lateral',
  conditioning: 'Cardio, GPP, work capacity',
};

export const BLOCK_TEMPLATES = {
  peaking: {
    label: 'Peaking', description: 'Maximizar fuerza para test de 1RM',
    defaultName: 'Peaking', defaultColor: '#f59e0b',
    suggestedTags: ['main_lift'], sessionsTarget: 10,
    params: { setsRange: [3,5], repsRange: [1,3], rpeRange: [8,9], intensityRange: [85,95], weightProgression: 'rpe_based', weeklyMod: 1.025, cnsLoad: 'high', suggestedFrequency: 2, notes: '', backoffPctOfTop: 0.93, backoffRepsAdjust: -1 },
  },
  accumulation: {
    label: 'Acumulación', description: 'Volumen base para hipertrofia',
    defaultName: 'Acumulación', defaultColor: '#3b82f6',
    suggestedTags: ['accessory', 'isolation'], sessionsTarget: 14,
    params: { setsRange: [3,5], repsRange: [5,8], rpeRange: [7,8], intensityRange: [70,80], weightProgression: 'linear', weeklyMod: 1.02, cnsLoad: 'medium', suggestedFrequency: 2, notes: '', backoffPctOfTop: 0.90, backoffRepsAdjust: 1 },
  },
  intensification: {
    label: 'Intensificación', description: 'Transición hacia peso pesado',
    defaultName: 'Intensificación', defaultColor: '#a855f7',
    suggestedTags: ['main_lift', 'secondary'], sessionsTarget: 10,
    params: { setsRange: [3,5], repsRange: [3,5], rpeRange: [8,9], intensityRange: [80,87], weightProgression: 'rpe_based', weeklyMod: 1.02, cnsLoad: 'high', suggestedFrequency: 2, notes: '', backoffPctOfTop: 0.90, backoffRepsAdjust: 0 },
  },
  hypertrophy: {
    label: 'Hipertrofia', description: 'Crecimiento muscular, alto volumen',
    defaultName: 'Hipertrofia', defaultColor: '#10b981',
    suggestedTags: ['accessory', 'isolation'], sessionsTarget: 14,
    params: { setsRange: [3,4], repsRange: [8,12], rpeRange: [8,9], intensityRange: [65,77], weightProgression: 'linear', weeklyMod: 1.015, cnsLoad: 'medium', suggestedFrequency: 2, notes: '', backoffPctOfTop: 0.95, backoffRepsAdjust: 0 },
  },
  deload: {
    label: 'Deload', description: 'Recuperación activa entre bloques',
    defaultName: 'Deload', defaultColor: '#94a3b8',
    suggestedTags: ['main_lift', 'secondary', 'accessory', 'isolation'], sessionsTarget: 2,
    params: { setsRange: [2,3], repsRange: [3,5], rpeRange: [6,7], intensityRange: [60,70], weightProgression: 'none', weeklyMod: 1.0, cnsLoad: 'low', suggestedFrequency: 2, notes: '', backoffPctOfTop: 0.90, backoffRepsAdjust: 0 },
  },
  maintenance: {
    label: 'Mantenimiento', description: 'Sin objetivo de progreso, sostener ganancias',
    defaultName: 'Mantenimiento', defaultColor: '#64748b',
    suggestedTags: ['secondary'], sessionsTarget: null,
    params: { setsRange: [2,3], repsRange: [5,6], rpeRange: [7,8], intensityRange: [75,80], weightProgression: 'none', weeklyMod: 1.0, cnsLoad: 'low', suggestedFrequency: 1, notes: '', backoffPctOfTop: 0.95, backoffRepsAdjust: 0 },
  },
  conditioning: {
    label: 'Conditioning', description: 'Capacidad cardiovascular, GPP',
    defaultName: 'Conditioning', defaultColor: '#ec4899',
    suggestedTags: ['conditioning'], sessionsTarget: 12,
    params: { setsRange: [3,5], repsRange: [10,20], rpeRange: [7,9], intensityRange: [50,70], weightProgression: 'linear', weeklyMod: 1.01, cnsLoad: 'medium', suggestedFrequency: 2, notes: '', backoffPctOfTop: 0.90, backoffRepsAdjust: 0 },
  },
  custom: {
    label: 'Personalizado', description: 'Vacío, definís todo manualmente',
    defaultName: 'Bloque personalizado', defaultColor: '#475569',
    suggestedTags: [], sessionsTarget: 12,
    params: { setsRange: [3,4], repsRange: [5,8], rpeRange: [7,8], intensityRange: [70,80], weightProgression: 'rpe_based', weeklyMod: 1.0, cnsLoad: 'medium', suggestedFrequency: 2, notes: '', backoffPctOfTop: 0.90, backoffRepsAdjust: 0 },
  },
};

export const BLOCK_COLOR_PALETTE = ['#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#14b8a6', '#f43f5e'];

export const createBlockFromTemplate = (templateKey, overrides = {}) => {
  const template = BLOCK_TEMPLATES[templateKey] || BLOCK_TEMPLATES.custom;
  const id = `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    name:           overrides.name   || template.defaultName,
    type:           templateKey,
    appliesTo:      overrides.appliesTo !== undefined ? overrides.appliesTo : [...(template.suggestedTags || [])],
    color:          overrides.color  || template.defaultColor,
    status:         'draft',
    createdAt:      new Date().toISOString(),
    startedAt:      null,
    completedAt:    null,
    sessionsTarget: overrides.sessionsTarget !== undefined ? overrides.sessionsTarget : template.sessionsTarget,
    sessionsLogged: 0,
    params:         { ...template.params, ...(overrides.params || {}) },
    fatigueSignals: { rpeOverTargetCount: 0, progressStallSessions: 0, lastChecked: null },
  };
};
