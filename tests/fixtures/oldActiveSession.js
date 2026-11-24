// Una activeSession GUARDADA ANTES de borrar el briefing/calentamiento de IA: trae las tres claves que el código
// ya no conoce (warmupPlan, briefing, subjectiveState). Sintética: nada viene de un backup real.
export const oldActiveSession = () => ({
  id: 'session-old-1',
  name: 'LEGS',
  routineId: null,
  sessionNum: null,
  contextNotes: '',
  closingNotes: '',
  exercises: [{
    id: 'ex-old-1',
    name: 'Sentadilla',
    equipment: 'barbell',
    tag: 'main_lift',
    restSeconds: 120,
    sets: [
      { id: 's1', type: 'top', weight: '100', reps: '5', rpe: '8', completed: true },
      { id: 's2', type: 'normal', weight: '90', reps: '5', rpe: '', completed: false },
    ],
  }],
  startTime: new Date(Date.now() - 45 * 60000).toISOString(),
  phaseEnabledExIds: ['ex-old-1'],
  // Las tres claves que ya nadie lee, con valores como los dejaba el flujo viejo:
  warmupPlan: { title: 'Protocolo de Activación', content: '1. Movilidad de cadera' },
  briefing: {
    fatigueWarning: 'Lumbar cargada',
    generalAdvice: 'Sesión liviana',
    perExercise: [{ name: 'Sentadilla', suggestedWeight: 100, reps: 5, rpe: 8, note: 'pausa' }],
  },
  subjectiveState: 'dormí poco',
});
