// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
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
    fireEvent.click(await screen.findByRole('switch').catch(() => screen.getByText(/Guardar como plantilla nueva/)));
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
      await waitFor(() => expect(screen.getByTestId('dedupe-undo')).toBeTruthy());
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
  it('Datos: tras ordenar y RECARGAR, "Deshacer orden de plantillas" sigue disponible y deja el estado original (sin pisar lo creado después)', async () => {
    const { db } = await import('../src/db/database.js');
    const { saveRoutine } = await import('../src/db/repository.js');
    await db.routines.bulkAdd([
      { routineId: 'L', id: 'L', name: 'LEGS', isImported: true, importedAt: '2026-10-09T00:00:00Z', createdAt: '2026-10-09T00:00:00Z', updatedAt: '2026-10-09T00:00:00Z', exercises: [{ id: 'e1', name: 'Sentadilla', sets: [] }] },
      { routineId: 'L', id: 'L', name: 'LEGS', isImported: true, importedAt: '2026-11-11T00:00:00Z', createdAt: '2026-11-11T00:00:00Z', updatedAt: '2026-11-11T00:00:00Z', exercises: [{ id: 'e1', name: 'Sentadilla', sets: [] }, { id: 'e2', name: 'Prensa', sets: [] }] },
    ]);
    const original = await db.routines.orderBy('_id').toArray();
    URL.createObjectURL = () => 'blob:test'; URL.revokeObjectURL = () => {};
    const confirm = window.confirm; window.confirm = () => true;
    const openDatos = async () => {
      await mount();
      fireEvent.click(screen.getByTitle(/Configuraci/i));
      fireEvent.click(await screen.findByRole('button', { name: 'Datos' }));
    };
    try {
      await openDatos();
      await waitFor(() => expect(screen.getByTestId('dedupe-panel')).toBeTruthy());
      fireEvent.click(screen.getByRole('button', { name: /1 · Descargar backup/ }));
      await waitFor(() => expect(screen.getByRole('button', { name: /Ordenar plantillas/ }).disabled).toBe(false));
      fireEvent.click(screen.getByRole('button', { name: /Ordenar plantillas/ }));
      await waitFor(() => expect(screen.getByTestId('dedupe-undo')).toBeTruthy());
      expect(await db.routines.count()).toBe(1);

      // "recargar": se desmonta todo y se vuelve a montar la app sobre la misma base
      cleanup();
      // lo que se crea DESPUÉS del orden no lo pisa el rollback
      await saveRoutine({ id: 'r-nueva', name: 'PLANTILLA NUEVA', exercises: [{ id: 'e1', name: 'Curl', sets: [] }] });
      await openDatos();
      await waitFor(() => expect(screen.getByTestId('dedupe-undo')).toBeTruthy());
      expect(screen.queryByTestId('dedupe-panel')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /Deshacer orden de plantillas/ }));
      await waitFor(() => expect(screen.getByTestId('dedupe-panel')).toBeTruthy()); // vuelve el dry-run: ya no hay registro
      expect(screen.queryByTestId('dedupe-undo')).toBeNull();

      const despues = await db.routines.orderBy('_id').toArray();
      expect(despues.filter((r) => r.routineId !== 'r-nueva')).toEqual(original); // estado original, fila por fila
      expect(despues.find((r) => r.routineId === 'r-nueva').name).toBe('PLANTILLA NUEVA');
      expect(await db.settings.get('routinesDedupeV1')).toBeUndefined();
    } finally { window.confirm = confirm; }
  });
  // ── F2: modal de cierre según origen + nombres únicos ──────────────────────────────────────────────────────
  const tplRow = (id, name, extra = {}) => ({
    id, routineId: id, name, exercises: [{ id: 'ex-old-1', name: 'Sentadilla', equipment: 'barbell', tag: 'main_lift', notes: 'Nota del Coach',
      sets: [{ id: 's1', type: 'top', weight: 80, reps: 5, rpe: '8', restSeconds: 150, targetSeconds: 30, completed: false },
             { id: 's2', type: 'normal', weight: 70, reps: 5, rpe: '', restSeconds: 150, completed: false }] }], ...extra,
  });
  const openFinish = async (session) => {
    const { setSetting } = await import('../src/db/repository.js');
    await setSetting('activeSession', session);
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: /Finalizar Misión/i }));
  };

  it('Cierre de una sesión de plantilla: sin campo de nombre y con "Actualizar plantilla <nombre>"; actualiza solo peso y reps', async () => {
    const { db } = await import('../src/db/database.js');
    await db.routines.add(tplRow('r-torso', 'TORSO'));
    const { setSetting } = await import('../src/db/repository.js');
    await setSetting('activeSession', { ...oldActiveSession(), name: 'TORSO', routineId: 'r-torso' });
    await mount();
    await screen.findByRole('button', { name: /Finalizar Misión/i });
    expect(screen.queryByRole('button', { name: /^Actualizar plantilla$/ })).toBeNull(); // ya no hay botón suelto en la sesión
    fireEvent.click(screen.getByRole('button', { name: /Finalizar Misión/i }));
    await waitFor(() => expect(screen.getByTestId('finish-origin')).toBeTruthy());
    // un solo "Actualizar plantilla": el resumen del diff está en el modal
    const diff = screen.getByTestId('update-diff');
    expect(diff.textContent).toMatch(/Cambios en la plantilla \(1\)/);
    expect(diff.textContent).toMatch(/Sentadilla · set 1/);
    expect(screen.queryByText('Nombre del Registro')).toBeNull();
    expect(screen.queryByText(/Guardar como plantilla nueva/)).toBeNull();
    fireEvent.click(screen.getByText('Actualizar plantilla TORSO'));
    fireEvent.click(screen.getByRole('button', { name: /Guardar en Historial/i }));
    await waitFor(async () => expect(await db.history.count()).toBe(1));
    expect((await db.history.toArray())[0].name).toBe('TORSO');
    await waitFor(async () => expect((await db.routines.toArray())[0].lastUpdatedAt).toBeTruthy());
    const rows = await db.routines.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].exercises[0].sets[0]).toMatchObject({ weight: 100, reps: 5, rpe: '8', restSeconds: 150, targetSeconds: 30 });
    expect(rows[0].exercises[0].notes).toBe('Nota del Coach');
    expect(rows[0].exercises[0].sets[1]).toMatchObject({ weight: 70 }); // el set que la sesión no completó se mantiene
  });

  it('Cierre de una sesión de plantilla SIN tocar el botón: la plantilla queda igual', async () => {
    const { db } = await import('../src/db/database.js');
    await db.routines.add(tplRow('r-torso', 'TORSO'));
    const antes = await db.routines.toArray();
    await openFinish({ ...oldActiveSession(), name: 'TORSO', routineId: 'r-torso' });
    fireEvent.click(await screen.findByRole('button', { name: /Guardar en Historial/i }));
    await waitFor(async () => expect(await db.history.count()).toBe(1));
    expect(await db.routines.toArray()).toEqual(antes);
  });

  it('Si la plantilla de origen está archivada o ya no existe: sesión libre, con aviso y campo de nombre', async () => {
    const { db } = await import('../src/db/database.js');
    await db.routines.add(tplRow('r-arch', 'VIEJA', { archived: true }));
    await openFinish({ ...oldActiveSession(), name: 'VIEJA', routineId: 'r-arch' });
    await waitFor(() => expect(screen.getByTestId('finish-origin-gone')).toBeTruthy());
    expect(screen.getByText('Nombre del Registro')).toBeTruthy();
    expect(screen.getByText(/Guardar como plantilla nueva/)).toBeTruthy();
    expect(screen.queryByTestId('finish-origin')).toBeNull();
  });

  it('Sesión libre + "Guardar como plantilla nueva" con un nombre ya usado por una ACTIVA: avisa, bloquea y ofrece actualizar la existente', async () => {
    const { db } = await import('../src/db/database.js');
    await db.routines.add(tplRow('r-legs', 'Legs'));
    await openFinish({ ...oldActiveSession(), name: 'LEGS' });
    fireEvent.click(await screen.findByText(/Guardar como plantilla nueva/));
    await waitFor(() => expect(screen.getByTestId('name-conflict')).toBeTruthy());
    expect(screen.getByRole('button', { name: /Guardar en Historial/i }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar la existente' }));
    await waitFor(() => expect(screen.getByTestId('merge-note')).toBeTruthy());
    expect(screen.getByRole('button', { name: /Guardar en Historial/i }).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /Guardar en Historial/i }));
    await waitFor(async () => expect(await db.history.count()).toBe(1));
    await waitFor(async () => expect((await db.routines.toArray())[0].lastUpdatedAt).toBeTruthy());
    expect(await db.routines.count()).toBe(1); // no se creó una segunda plantilla
  });

  it('Conflicto de nombre: "Cambiar nombre" deja el botón bloqueado hasta que el nombre es único; una ARCHIVADA no cuenta', async () => {
    const { db } = await import('../src/db/database.js');
    await db.routines.bulkAdd([tplRow('r-legs', 'Legs'), tplRow('r-dl', 'DL', { archived: true })]);
    await openFinish({ ...oldActiveSession(), name: 'LEGS' });
    fireEvent.click(await screen.findByText(/Guardar como plantilla nueva/));
    await waitFor(() => expect(screen.getByTestId('name-conflict')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar nombre' }));
    expect(screen.getByRole('button', { name: /Guardar en Historial/i }).disabled).toBe(true);
    const input = screen.getByPlaceholderText('Ej: Empuje Pesado');
    fireEvent.change(input, { target: { value: 'DL' } }); // existe pero archivada: permitido
    await waitFor(() => expect(screen.queryByTestId('name-conflict')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /Guardar en Historial/i }));
    await waitFor(async () => expect(await db.routines.count()).toBe(3));
    expect((await db.routines.toArray()).filter((r) => r.name === 'DL')).toHaveLength(2);
  });

  it('Mis plantillas: renombrar a un nombre ya usado por otra ACTIVA se bloquea; el mismo nombre con otras mayúsculas no choca consigo misma', async () => {
    const { db } = await import('../src/db/database.js');
    await db.routines.bulkAdd([tplRow('r-a', 'LEGS'), tplRow('r-b', 'DL')]);
    await mount();
    fireEvent.click(screen.getByText(/Mis plantillas/));
    await waitFor(() => expect(screen.getByText('DL')).toBeTruthy());
    fireEvent.click(screen.getByText('DL')); // entra al modo edición de nombre
    const input = await waitFor(() => { const i = document.querySelector('main input.border-accent-500'); expect(i).toBeTruthy(); return i; });
    fireEvent.change(input, { target: { value: 'legs' } });
    fireEvent.click(input.parentElement.querySelector('button'));
    await waitFor(() => expect(screen.getByText(/Ya hay una plantilla activa llamada "LEGS"/)).toBeTruthy());
    expect((await db.routines.toArray()).find((r) => r.routineId === 'r-b').name).toBe('DL');
    fireEvent.change(input, { target: { value: 'dl' } }); // consigo misma: permitido
    fireEvent.click(input.parentElement.querySelector('button'));
    await waitFor(async () => expect((await db.routines.toArray()).find((r) => r.routineId === 'r-b').name).toBe('dl'));
  });

  it('Mis plantillas: restaurar una archivada que repetiría el nombre de una ACTIVA se bloquea', async () => {
    const { db } = await import('../src/db/database.js');
    await db.routines.bulkAdd([tplRow('r-a', 'LEGS'), tplRow('r-old', 'legs', { archived: true })]);
    await mount();
    fireEvent.click(screen.getByText(/Mis plantillas/));
    fireEvent.click(await screen.findByText(/^Archivadas/));
    await waitFor(() => expect(screen.getByText('legs')).toBeTruthy());
    fireEvent.click(document.querySelector('main .relative.shrink-0 > button'));
    fireEvent.click(await screen.findByText('Desarchivar'));
    await waitFor(() => expect(screen.getByText(/Ya hay una plantilla activa llamada "LEGS"/)).toBeTruthy());
    expect((await db.routines.toArray()).find((r) => r.routineId === 'r-old').archived).toBe(true);
  });
  it('Mis plantillas: "Nueva" no repite el nombre de una activa ("Nueva Plantilla", "Nueva Plantilla 2")', async () => {
    const { db } = await import('../src/db/database.js');
    await db.routines.add(tplRow('r-n', 'Nueva Plantilla'));
    await mount();
    fireEvent.click(screen.getByText(/Mis plantillas/));
    fireEvent.click(await screen.findByRole('button', { name: /Nueva$/ }));
    await waitFor(async () => expect(await db.routines.count()).toBe(2));
    expect((await db.routines.toArray()).map((r) => r.name).sort()).toEqual(['Nueva Plantilla', 'Nueva Plantilla 2']);
  });
  // ── C: menú ⋮ de Mis plantillas, "Editar nombre" y wizard "Limpiar" ───────────────────────────────────────────
  const abrirPlantillas = async (rows) => {
    const { db } = await import('../src/db/database.js');
    await db.routines.bulkAdd(rows);
    await mount();
    fireEvent.click(screen.getByText(/Mis plantillas/));
    await waitFor(() => expect(screen.getByText(rows[0].name)).toBeTruthy());
    return db;
  };
  const kebabs = () => [...document.querySelectorAll('main .relative.shrink-0 > button')];

  it('Menú ⋮ → "Editar nombre" entra en modo edición (antes el handler lo cerraba en el mismo clic) y guarda', async () => {
    const db = await abrirPlantillas([tplRow('r-a', 'LEGS'), tplRow('r-b', 'DL')]);
    fireEvent.click(kebabs()[1]); // menú de DL
    fireEvent.click(await screen.findByText('Editar nombre'));
    const input = await waitFor(() => { const i = document.querySelector('main input.border-accent-500'); expect(i).toBeTruthy(); return i; });
    expect(input.value).toBe('DL');
    expect(screen.queryByText('Editar nombre')).toBeNull(); // el menú se cierra al entrar en edición
    fireEvent.change(input, { target: { value: 'DL pesado' } });
    fireEvent.click(input.parentElement.querySelector('button'));
    await waitFor(async () => expect((await db.routines.toArray()).find((r) => r.routineId === 'r-b').name).toBe('DL pesado'));
    expect((await db.routines.toArray()).find((r) => r.routineId === 'r-a').name).toBe('LEGS');
  });

  it('"Editar nombre" también funciona desde el menú de la ÚLTIMA fila', async () => {
    await abrirPlantillas([tplRow('r-a', 'LEGS'), tplRow('r-b', 'DL'), tplRow('r-c', 'TORSO')]);
    const ks = kebabs();
    fireEvent.click(ks[ks.length - 1]);
    fireEvent.click(await screen.findByText('Editar nombre'));
    await waitFor(() => expect(document.querySelector('main input.border-accent-500')?.value).toBe('TORSO'));
  });

  it('Menú ⋮ de la última fila: ningún contenedor intermedio lo recorta (sin overflow-hidden entre el menú y <main>)', async () => {
    await abrirPlantillas([tplRow('r-a', 'LEGS'), tplRow('r-b', 'DL'), tplRow('r-c', 'TORSO')]);
    const ks = kebabs();
    fireEvent.click(ks[ks.length - 1]);
    const menu = (await screen.findByText('Editar nombre')).closest('.absolute');
    expect(menu).toBeTruthy();
    const recortan = [];
    for (let el = menu.parentElement; el && el.tagName !== 'MAIN'; el = el.parentElement) {
      if (/\boverflow-(hidden|auto|scroll|clip)\b/.test(el.className)) recortan.push(el.className.slice(0, 60));
    }
    expect(recortan).toEqual([]);
    for (const l of ['Clonar', 'Archivar', 'Borrar']) expect(screen.getByText(l)).toBeTruthy();
  });

  it('Menú ⋮ con poco lugar abajo (última fila contra la barra): se abre hacia ARRIBA; con lugar, hacia abajo', async () => {
    await abrirPlantillas([tplRow('r-a', 'LEGS'), tplRow('r-b', 'DL')]);
    const ks = kebabs();
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    try {
      rect.mockReturnValue({ top: 640, bottom: 676, left: 0, right: 0, width: 36, height: 36, x: 0, y: 640 });
      fireEvent.click(ks[1]);
      expect((await screen.findByText('Editar nombre')).closest('.absolute').className).toMatch(/\bbottom-10\b/);
      fireEvent.click(ks[1]); // cierra
      rect.mockReturnValue({ top: 100, bottom: 136, left: 0, right: 0, width: 36, height: 36, x: 0, y: 100 });
      fireEvent.click(ks[0]);
      expect((await screen.findByText('Editar nombre')).closest('.absolute').className).toMatch(/\btop-10\b/);
    } finally { rect.mockRestore(); }
  });

  it('Padding inferior de la pantalla = barra + safe-area (no un valor fijo)', async () => {
    await mount();
    expect(document.querySelector('main').className).toContain('env(safe-area-inset-bottom');
  });

  it('Mis plantillas ya no tiene el wizard "Limpiar"', async () => {
    await abrirPlantillas([tplRow('r-a', 'LEGS')]);
    expect(screen.queryByRole('button', { name: /Limpiar/ })).toBeNull();
    expect(screen.queryByText(/Limpiar rutinas/)).toBeNull();
    expect(screen.getByRole('button', { name: /Nueva$/ })).toBeTruthy(); // el resto de la barra sigue
  });
});
