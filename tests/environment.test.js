import { describe, it, expect } from 'vitest';

// Si estos tests fallan, la zona horaria no es la de la usuaria y cualquier test de
// fechas (formatShortDate, ventanas de 7 días, "Última sesión") daría resultados falsos.
describe('entorno de tests', () => {
  it('TZ es America/Santiago', () => {
    expect(process.env.TZ).toBe('America/Santiago');
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Santiago');
  });

  it('el huso horario es el de Chile: UTC-3 en verano, UTC-4 en invierno', () => {
    // getTimezoneOffset() = minutos que hay que SUMAR a la hora local para llegar a UTC.
    expect(new Date('2026-01-15T12:00:00Z').getTimezoneOffset()).toBe(180);
    expect(new Date('2026-07-15T12:00:00Z').getTimezoneOffset()).toBe(240);
  });

  it('una medianoche UTC cae el día anterior en hora local', () => {
    const d = new Date('2026-01-05T01:00:00Z'); // 22:00 del 4-ene en Santiago (verano)
    expect(d.getDate()).toBe(4);
  });

  it('hay un localStorage de prueba, vacío al empezar cada test', () => {
    expect(globalThis.localStorage.length).toBe(0);
    globalThis.localStorage.setItem('x', '1');
    expect(globalThis.localStorage.getItem('x')).toBe('1');
  });
  it('el localStorage se reinicia entre tests', () => {
    expect(globalThis.localStorage.getItem('x')).toBeNull();
  });
});
