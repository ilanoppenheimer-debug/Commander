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
});
