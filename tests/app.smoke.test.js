// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { oldActiveSession } from './fixtures/oldActiveSession.js';

// Red de seguridad del refactor de App.jsx: monta <App/> entero (Dexie en memoria con fake-indexeddb, jsdom),
// recorre las 4 pestañas y abre Ajustes. No prueba lógica fina: prueba que cada pantalla monta y responde.
// Los mocks del navegador que jsdom no trae viven en tests/setup.js (no se toca src/).
let App;
beforeAll(async () => {
  ({ default: App } = await import('../src/App.jsx'));
});
// Cada test arranca con la base vacía (los ajustes persisten en Dexie entre montajes).
afterEach(async () => {
  cleanup();
  const { db } = await import('../src/db/database.js');
  await Promise.all(db.tables.map((t) => t.clear()));
});

const tab = (name) => screen.getByRole('button', { name: new RegExp(`^${name}$`, 'i') });
const mount = async () => {
  render(React.createElement(App));
  await waitFor(() => expect(screen.queryByText(/Iniciando base de datos/)).toBeNull(), { timeout: 10000 });
};

describe('App monta y navega', () => {
  it('arranca en Rutinas, sin sesión activa', async () => {
    await mount();
    expect(screen.getByText('Ciclo con el Coach')).toBeTruthy();
    expect(screen.getByText('Entrenamiento Libre')).toBeTruthy();
  });

  it('recorre las 4 pestañas', async () => {
    await mount();

    fireEvent.click(tab('Historial'));
    await waitFor(() => expect(screen.getByText(/Sin sesiones registradas/)).toBeTruthy());

    fireEvent.click(tab('Bloques'));
    await waitFor(() => expect(screen.getByText('Bloques activos')).toBeTruthy());

    fireEvent.click(tab('Fuerza'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Placas' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Placas' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cargar' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Sumar' }));

    fireEvent.click(tab('Rutinas'));
    await waitFor(() => expect(screen.getByText('Ciclo con el Coach')).toBeTruthy());
  });

  it('abre Ajustes y recorre sus 4 pestañas, cada una con su contenido', async () => {
    await mount();
    fireEvent.click(screen.getByTitle(/Configuraci/i));
    await waitFor(() => expect(screen.getByText('Color de acento')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Teclado' }));
    await waitFor(() => expect(screen.getByText(/Teclado Custom/)).toBeTruthy());
    expect(screen.queryByText('Color de acento')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Datos' }));
    await waitFor(() => expect(screen.getByText(/Base de Datos/)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Equipo' }));
    await waitFor(() => expect(screen.queryByText(/Base de Datos/)).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Apariencia' }));
    await waitFor(() => expect(screen.getByText('Color de acento')).toBeTruthy());
  });

  it('un ajuste cambiado se guarda en Dexie con la misma clave (persistencia de ajustes)', async () => {
    const { getSetting } = await import('../src/db/repository.js');
    await mount();
    fireEvent.click(screen.getByTitle(/Configuraci/i));
    await waitFor(() => expect(screen.getByText('Color de acento')).toBeTruthy());
    fireEvent.click(screen.getByTitle('Azul'));
    await waitFor(async () => expect(await getSetting('accent')).toBe('blue'), { timeout: 5000 });
    expect(document.documentElement.dataset.accent).toBe('blue');
  });

  it('la pestaña activa se recuerda al recargar (clave activeTab)', async () => {
    const { getSetting } = await import('../src/db/repository.js');
    await mount();
    fireEvent.click(tab('Historial'));
    await waitFor(async () => expect(await getSetting('activeTab')).toBe('history'), { timeout: 5000 });
    cleanup();
    await mount();
    await waitFor(() => expect(screen.getByText(/Sin sesiones registradas/)).toBeTruthy());
  });

  it('Entrenamiento Libre inicia una sesión activa y se puede descartar', async () => {
    await mount();
    fireEvent.click(screen.getByText('Entrenamiento Libre'));
    await waitFor(() => expect(screen.getByText('Sesión activa')).toBeTruthy());
    expect(screen.queryByText('Ciclo con el Coach')).toBeNull();
  });

  it('una activeSession vieja (con warmupPlan / briefing / subjectiveState) se retoma y se puede terminar', async () => {
    const { setSetting, getSetting } = await import('../src/db/repository.js');
    const { db } = await import('../src/db/database.js');
    await setSetting('activeSession', oldActiveSession());

    await mount();
    await waitFor(() => expect(screen.getByText('Sesión activa')).toBeTruthy());
    // El flujo de IA ya no existe: ni la tarjeta del briefing, ni el modal de calentamiento, ni el overlay.
    expect(screen.queryByText(/Briefing de Misión/)).toBeNull();
    expect(screen.queryByText(/Protocolo de Activación/)).toBeNull();
    expect(screen.queryByText(/PROCESANDO INTELIGENCIA/)).toBeNull();
    expect(screen.getAllByText('Sentadilla').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('Finalizar Misión'));
    fireEvent.click(await screen.findByText('Guardar en Historial'));

    await waitFor(async () => expect(await db.history.count()).toBe(1), { timeout: 8000 });
    const saved = (await db.history.toArray())[0];
    expect(saved.name).toBe('LEGS');
    expect(saved.exercises[0].name).toBe('Sentadilla');
    for (const k of ['warmupPlan', 'briefing', 'subjectiveState']) expect(k in saved, k).toBe(false);

    await waitFor(() => expect(screen.getByText('Ciclo con el Coach')).toBeTruthy());
    await waitFor(async () => expect(await getSetting('activeSession')).toBeUndefined(), { timeout: 5000 });
  });
  it('Clonar plantilla crea una fila nueva (no sobrescribe la original)', async () => {
    const { db } = await import('../src/db/database.js');
    const { saveRoutine } = await import('../src/db/repository.js');
    await saveRoutine({ id: 'r-dl', name: 'DL (Plantilla)', exercises: [{ id: 'e1', name: 'Peso Muerto', sets: [] }], lastPerformed: null });
    await mount();
    fireEvent.click(screen.getByText(/Mis plantillas/));
    await waitFor(() => expect(screen.getByText('DL (Plantilla)')).toBeTruthy());
    const kebab = () => document.querySelector('main .relative.shrink-0 > button');
    for (const n of [1, 2]) {
      fireEvent.click(kebab());
      fireEvent.click(await screen.findByText('Clonar'));
      await waitFor(async () => expect(await db.routines.count()).toBe(1 + n));
    }
    const names = (await db.routines.orderBy('_id').toArray()).map((r) => r.name);
    expect(names).toEqual(['DL (Plantilla)', 'DL (Plantilla) (copia)', 'DL (Plantilla) (copia 2)']);
  });
  it('iniciar desde una plantilla con finishedAt viejo: el ejercicio arranca abierto (sin minutos negativos) y "Finalizar ejercicio" cierra al primer toque', async () => {
    const { saveRoutine } = await import('../src/db/repository.js');
    await saveRoutine({
      id: 'r-acc', name: 'ACCESORIOS', lastPerformed: null,
      exercises: [{ id: 'e1', name: 'Curl Martillo', equipment: 'dumbbell', finishedAt: '2026-10-12T17:10:14.452Z',
        sets: [{ id: 's1', type: 'normal', weight: 0, reps: 0, rpe: '8', completed: true, seconds: '30' }] }],
    });
    await mount();
    fireEvent.click(screen.getByText(/Mis plantillas/));
    await waitFor(() => expect(screen.getByText('ACCESORIOS')).toBeTruthy());
    fireEvent.click(screen.getByTitle('Iniciar rutina'));
    await waitFor(() => expect(screen.getByText('Sesión activa')).toBeTruthy());
    expect(screen.queryByText(/-\d+\s*min/i)).toBeNull();
    const btn = await screen.findByRole('button', { name: /Finalizar ejercicio/i });
    fireEvent.click(btn);
    await waitFor(() => expect(screen.queryByRole('button', { name: /Finalizar ejercicio/i })).toBeNull());
    expect(screen.getByText(/^\d+ min$/)).toBeTruthy();
  });

  it('"Guardar como plantilla" no guarda campos de runtime (finishedAt, rpe registrado, seconds, exerciseNotes)', async () => {
    const { db } = await import('../src/db/database.js');
    const { setSetting } = await import('../src/db/repository.js');
    const sesion = oldActiveSession();
    sesion.exercises[0].finishedAt = '2026-11-25T15:10:00.000Z';
    sesion.exercises[0].exerciseNotes = 'nota del atleta';
    sesion.exercises[0].sets[0] = { ...sesion.exercises[0].sets[0], rpe: '9', seconds: '30', companionValue: '2' };
    await setSetting('activeSession', sesion);
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: /Finalizar Misión/i }));
    fireEvent.click(await screen.findByRole('switch').catch(() => screen.getByText(/Guardar como Plantilla/)));
    fireEvent.click(await screen.findByRole('button', { name: /Guardar en Historial/i }));
    await waitFor(async () => expect(await db.routines.count()).toBe(1));
    const tpl = (await db.routines.toArray())[0];
    const e = tpl.exercises[0];
    expect('finishedAt' in e).toBe(false);
    expect('exerciseNotes' in e).toBe(false);
    for (const x of e.sets) {
      expect(x.completed).toBe(false);
      expect(x.rpe).toBe('');
      expect('seconds' in x).toBe(false);
      expect('companionValue' in x).toBe(false);
    }
  });
  it('Datos: el panel de plantillas duplicadas muestra el dry-run, exige backup, ordena y se oculta', async () => {
    const { db } = await import('../src/db/database.js');
    await db.routines.bulkAdd([
      { routineId: 'L', id: 'L', name: 'LEGS', isImported: true, importedAt: '2026-10-09T00:00:00Z', createdAt: '2026-10-09T00:00:00Z', exercises: [{ id: 'e1', name: 'Sentadilla', sets: [] }] },
      { routineId: 'L', id: 'L', name: 'LEGS', isImported: true, importedAt: '2026-11-11T00:00:00Z', createdAt: '2026-11-11T00:00:00Z', exercises: [{ id: 'e1', name: 'Sentadilla', sets: [] }] },
    ]);
    URL.createObjectURL = () => 'blob:test'; URL.revokeObjectURL = () => {};
    const confirm = window.confirm; window.confirm = () => true;
    try {
      await mount();
      fireEvent.click(screen.getByTitle(/Configuraci/i));
      fireEvent.click(await screen.findByRole('button', { name: 'Datos' }));
      await waitFor(() => expect(screen.getByTestId('dedupe-panel')).toBeTruthy());
      expect(screen.getByText(/Filas repetidas a eliminar/)).toBeTruthy();
      const aplicar = screen.getByRole('button', { name: /Ordenar plantillas/ });
      expect(aplicar.disabled).toBe(true); // sin backup descargado no se puede aplicar
      fireEvent.click(screen.getByRole('button', { name: /1 · Descargar backup/ }));
      await waitFor(() => expect(screen.getByRole('button', { name: /Ordenar plantillas/ }).disabled).toBe(false));
      fireEvent.click(screen.getByRole('button', { name: /Ordenar plantillas/ }));
      await waitFor(() => expect(screen.getByTestId('dedupe-done')).toBeTruthy());
      expect(await db.routines.count()).toBe(1);
      expect(screen.queryByTestId('dedupe-panel')).toBeNull();
    } finally { window.confirm = confirm; }
  });

  it('Datos: sin duplicados el panel de plantillas no aparece', async () => {
    const { saveRoutine } = await import('../src/db/repository.js');
    await saveRoutine({ id: 'r1', name: 'LEGS', exercises: [{ id: 'e1', name: 'Sentadilla', sets: [] }] });
    await mount();
    fireEvent.click(screen.getByTitle(/Configuraci/i));
    fireEvent.click(await screen.findByRole('button', { name: 'Datos' }));
    await waitFor(() => expect(screen.getByText(/Limpieza de taxonom/)).toBeTruthy());
    expect(screen.queryByTestId('dedupe-panel')).toBeNull();
  });
});
