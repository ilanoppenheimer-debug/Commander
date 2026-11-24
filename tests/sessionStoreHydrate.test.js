import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from '../src/stores/sessionStore.js';
import { setSetting, getSetting } from '../src/db/repository.js';
import { db } from '../src/db/database.js';
import { oldActiveSession } from './fixtures/oldActiveSession.js';

// Se borraron warmupPlan / briefing / subjectiveState y sus setters. Una activeSession guardada ANTES (o restaurada de
// un backup viejo) todavía trae esas claves: tienen que ser inofensivas.
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  useSessionStore.setState({ session: null, hydrated: false, lastDeleted: null });
});

describe('activeSession vieja con warmupPlan / briefing / subjectiveState', () => {
  it('el store ya no tiene los setters de IA', () => {
    const s = useSessionStore.getState();
    for (const k of ['setWarmupPlan', 'setBriefing', 'setSubjectiveState']) expect(s[k], k).toBeUndefined();
  });

  it('una sesión nueva no trae esas claves', () => {
    useSessionStore.getState().startSession(null);
    const s = useSessionStore.getState().session;
    for (const k of ['warmupPlan', 'briefing', 'subjectiveState']) expect(k in s, k).toBe(false);
  });

  it('se hidrata desde Dexie con sus ejercicios y sets intactos', async () => {
    await setSetting('activeSession', oldActiveSession());
    await useSessionStore.getState().hydrateFromDb();
    const { session, hydrated } = useSessionStore.getState();
    expect(hydrated).toBe(true);
    expect(session.name).toBe('LEGS');
    expect(session.exercises).toHaveLength(1);
    expect(session.exercises[0].sets).toHaveLength(2);
  });

  it('sigue funcionando: se pueden editar sets, agregar y quitar ejercicios', async () => {
    await setSetting('activeSession', oldActiveSession());
    await useSessionStore.getState().hydrateFromDb();
    const st = useSessionStore.getState();

    st.updateSet('ex-old-1', 1, 'reps', '6');
    expect(useSessionStore.getState().session.exercises[0].sets[1].reps).toBe('6');

    st.addSet('ex-old-1');
    expect(useSessionStore.getState().session.exercises[0].sets).toHaveLength(3);

    st.addExercise('Press Banca', 'barbell');
    expect(useSessionStore.getState().session.exercises).toHaveLength(2);
  });

  it('se puede terminar: la sesión se limpia y se borra de Dexie', async () => {
    await setSetting('activeSession', oldActiveSession());
    await useSessionStore.getState().hydrateFromDb();
    expect(useSessionStore.getState().session).not.toBeNull();

    useSessionStore.getState().finishSession();
    expect(useSessionStore.getState().session).toBeNull();
    await new Promise((r) => setTimeout(r, 700)); // persistToDb tiene un debounce de 500 ms
    expect(await getSetting('activeSession')).toBeUndefined();
  });

  it('descartar también funciona', async () => {
    await setSetting('activeSession', oldActiveSession());
    await useSessionStore.getState().hydrateFromDb();
    useSessionStore.getState().discardSession();
    expect(useSessionStore.getState().session).toBeNull();
  });
});
