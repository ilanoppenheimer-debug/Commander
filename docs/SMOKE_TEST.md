# Iron Commander — Smoke Test del Paso 1

Verificación manual post-implementación de la fundación de datos.
**Tiempo estimado:** 30-40 minutos.
**Importancia:** Crítica. Tus 5 meses de historial dependen de que esto funcione.

---

## Bloque 1 — Datos intactos (10 min)

- [ ] **1.** La app carga sin errores con datos existentes
- [ ] **2.** Los datos migrados desde localStorage son visibles en UI (Historial muestra sesiones)
- [ ] **3.** En localStorage existe `IronSuiteDataV14_BACKUP_{fecha}` con la data original como fallback

## Bloque 2 — Sesión y persistencia (5 min)

- [ ] **4.** Una sesión nueva se puede empezar y loggear sets
- [ ] **5.** Un set logueado persiste tras reload con F5
- [ ] **18.** Cerrar la app a mitad de sesión, abrir de nuevo, verificar que continúa exactamente donde estaba

## Bloque 3 — Google Drive (10 min)

- [ ] **6.** Sign-in a Google Drive funciona y muestra el email correcto
- [ ] **7.** Se crea una carpeta "Iron Commander Backups" en el Drive real del usuario (verificar en drive.google.com)
- [ ] **8.** Un backup se sube exitosamente a Drive y aparece en la lista de Settings

## Bloque 4 — Restore y resiliencia (5 min)

- [ ] **11.** Un backup descargado a disco se puede restaurar correctamente
- [ ] **12.** El ErrorBoundary no borra datos cuando se rompe
  - Para forzarlo: abrí DevTools console y escribí `throw new Error("test")` en algún render handler
  - Verificá que aparece el ErrorFallback con opción "Exportar mis datos AHORA"
  - Reintentá y los datos siguen ahí

## Bloque 5 — Bugs arreglados (5 min)

- [ ] **13.** Bug 1: inventory merge respeta valores custom sobre defaults
- [ ] **13.** Bug 2: PlateVisualizer no rompe con plates null
- [ ] **13.** Bug 3: AdvancedTimer cambia entre stopwatch/timer sin estado inconsistente
- [ ] **13.** Bug 4: ExerciseSelectorModal no muestra duplicados case-sensitive
- [ ] **13.** Bug 5: sessionBriefing.js parsea JSON con fallback regex
- [ ] **13.** Bug 6: CSV import valida números con Number.isFinite
- [ ] **13.** Bug 7: active session persiste correctamente con Zustand+Dexie

## Bloque 6 — Misc (5 min)

- [ ] **14.** El timer mantiene estado coherente al cambiar modos
- [ ] **15.** Settings > Datos y Backup muestra contadores correctos (X sesiones, Y rutinas)
- [ ] **17.** Logs se escriben correctamente y se pueden ver/exportar desde Settings

## Bloque 7 — Diferido (verificar con uso real)

- [ ] **9.** Rotación funciona: tras 8 días de uso, solo hay 7 backups diarios + semanales
- [ ] **10.** Multi-device: modificar en celular, traer última versión en laptop, ver cambios
- [ ] **16.** Modo offline: backups se guardan pendientes y se suben al volver online

## Bloque 8 — Paso 0b-1: UX de entrenamiento (Paso nuevo)

- [ ] **11.** Botón "✓ Hecho" en serie: tocar completa la serie (fondo verde, check verde), los inputs se ven con opacidad reducida y tachados
- [ ] **12.** Timer se dispara automáticamente al completar una serie. En superset de A-B-C, solo dispara después de completar un set de C (último del grupo), no de A ni B
- [ ] **13.** Sonido del timer: 3 beeps ascendentes (660→880→1100 Hz sine), vibración. Pre-alerta suave a los 10s restantes
- [ ] **14.** Modal pre-sesión: activar toggle en Settings > Apariencia > "Vista previa antes de iniciar". Al tocar ▶ en plantilla abre modal editable con pesos/reps. Editar un peso y tocar Comenzar: la sesión arranca con el peso modificado, la plantilla original no cambia
- [ ] **15.** Modal pre-sesión permite agregar ejercicio adicional abriendo el selector de ejercicios
- [ ] **16.** Superset de 3 ejercicios: crear A, B, C consecutivos, vincular A-B y luego B-C. Debe aparecer badge "TRISET" sobre el grupo, línea vertical izquierda abarca los 3, cada ejercicio muestra "1/3", "2/3", "3/3"
- [ ] **17.** Tabs del selector de ejercicios: tab Pecho muestra solo ejercicios de pecho, tab Recientes muestra ejercicios de últimas 4 semanas, tab Favoritos vacío inicialmente
- [ ] **18.** Crear ejercicio nuevo desde el selector: botón "+ Crear" abre modal con campos nombre, grupo muscular, equipo, unilateral (requeridos). Acordeón "avanzado" cerrado por default. Al crear, aparece en la lista
- [ ] **19.** Detección de duplicados: al escribir "Press Banca" en el modal de crear, debe aparecer banner amarillo "Ya existe 'Press Banca'" con botón "Usar este"
- [ ] **20.** Tap largo (500ms) en ejercicio del selector abre modal de edición de metadata con datos precargados
- [ ] **21.** Iconos nuevos de músculos: los ejercicios de Pecho muestran icono de pecho (no Shield), Espalda muestra dorsal, Piernas muestra piernas, etc.
- [ ] **22.** Compartir sesión: abrir menú ⋯ en card de historial > Compartir > "Copiar como texto" pega el formato correcto con nombre, fecha, ejercicios, sets y total
- [ ] **23.** Si el dispositivo soporta Web Share API: opción "Compartir…" abre el sheet nativo del sistema operativo
- [ ] **24.** Descargar JSON del día genera archivo con nombre `IronCmdr_[Sesión]_[fecha].json` con datos correctos de la sesión

## Bloque 9 — Paso 0b-2A: Dexie + backups + manifest + descargas

- [ ] **25.** Migración inicial: abrir app post-update. En Application → IndexedDB existe `IronCommanderDB` con tablas `backups`, `history`, `routines`, `settings`.
- [ ] **26.** Persistencia: crear plantilla nueva, recargar la app, plantilla sigue ahí.
- [ ] **27.** Sesión activa persiste: iniciar sesión, marcar 1 set como completado, cerrar pestaña y reabrir. La sesión sigue activa con el progreso.
- [ ] **28.** Backup automático: finalizar sesión, ir a Settings → Datos → Respaldos automáticos. Aparece un ítem con fecha actual y trigger "session completed".
- [ ] **29.** Trim de backups: después de 8+ sesiones, solo se mantienen 7 backups (el más viejo desaparece).
- [ ] **30.** Descargar backup automático: botón de descarga en ítem de respaldo descarga `IronCmdr_backup_session_completed_YYYY-MM-DD.json`.
- [ ] **31.** Restaurar backup automático: botón restaurar pide confirmación. Tras confirmar, los datos se restauran y la app funciona.
- [ ] **32.** Export manual: Settings → Datos → Backup Local → Descargar. Descarga `IronCmdr_backup_YYYY-MM-DD.json` con estructura válida.
- [ ] **33.** Nombres de descarga: sesión individual descarga `IronCmdr_session_*`, historial CSV descarga `IronCmdr_history_*`, logs descargan `IronCmdr_logs_*`.
- [ ] **34.** Manifest PWA: desinstalar la PWA actual. Reinstalar desde el navegador. El nombre debe ser "Iron Commander" y short_name "Iron Cmdr" (no "MySite").
- [ ] **35.** localStorage intacto post-migración: en DevTools → Application → Local Storage, la key `IronSuiteDataV14_BACKUP_*` sigue presente.
- [ ] **36.** Botón "Eliminar respaldo localStorage antiguo": en Settings → Datos → Zona de Peligro. Pide confirmación. La app sigue funcionando tras confirmar.

## Bloque 10 — Paso 0b-2B: Calculadora de Fuerza Rediseñada

- [ ] **37.** Abrir tab Fuerza. Por default está en "Mis 1RM". Si hay historial, aparece lista de ejercicios con 1RM estimado.
- [ ] **38.** Cambiar timeframe de 12 sem a 6 sem. Lista se actualiza. Ejercicios sin sets recientes desaparecen.
- [ ] **39.** Tocar un ejercicio (ej: Sentadilla). Aparecen los 3 top sets ordenados de mayor 1RM a menor. Las fechas son recientes.
- [ ] **40.** Desde el detalle, tocar "Ver evolución". TrendModal abre con el ejercicio correcto.
- [ ] **41.** Desde el detalle, tocar "Calcular series de trabajo". Va a Modo 2 con peso/reps/RPE pre-cargados del top set.
- [ ] **42.** En Modo 2, cambiar el peso. El 1RM se recalcula instantáneamente. La tabla de series se actualiza.
- [ ] **43.** Vaciar el campo RPE. Aparece warning "Usando Epley". El 1RM se recalcula con fórmula Epley.
- [ ] **44.** En el selector de ejercicio de Modo 2, escribir "sent". Aparecen ejercicios que matchean (Sentadilla, etc).
- [ ] **45.** Los pesos en la tabla de series son múltiplos de 2.5. Verificar: 1RM 200kg → 8 reps @ RPE 7 debe dar ~152.5kg.
- [ ] **46.** El archivo `WorkCalculator.jsx` ya no existe. La app no rompe.
- [ ] **47.** Sin historial: Modo 1 muestra "Aún no tenés sesiones registradas". Modo 2 funciona pero sin autocomplete.
- [ ] **48.** Verificación matemática: set 160kg×2 @ RPE 9 → 1RM estimado ≈ 172kg (tabla RTS: factor 0.930 → 160/0.930 = 172.0).

---

## Bloque 11 — Paso 0b-2D: Teclado custom + rediseño de sets

- [ ] **49.** Iniciar sesión, tap en el valor de peso de un set. Bottom sheet sube con animación desde abajo.
- [ ] **50.** Tap fuera del sheet o tap en ✓ verde. Sheet baja con animación y el valor queda guardado.
- [ ] **51.** Tipear "92.5" con el numpad. El campo KG muestra "92.5" en tiempo real.
- [ ] **52.** Tap corto en ⌫ borra un dígito.
- [ ] **53.** Tap largo (600ms) en ⌫ limpia el campo completo.
- [ ] **54.** El botón "." está deshabilitado (opaco) cuando el campo activo es REPS. En KG y RPE funciona.
- [ ] **55.** Tap en KG / REPS / RPE arriba del numpad cambia el campo activo. El borde accent-500 se mueve al nuevo campo.
- [ ] **56.** Botón SIG→: estando en KG → pasa a REPS. En REPS → pasa a RPE. En RPE → si hay más sets, pasa al KG del siguiente; en el último set cierra el teclado.
- [ ] **57.** Ejercicio tipo barbell muestra −5 / −2.5 / +2.5 / +5. Cambiar el equipo a dumbbell muestra −2 / −1 / +1 / +2.
- [ ] **58.** Con peso=92.5, tap en +5 → 97.5. Tap en −2.5 → 95. Sin desbordarse.
- [ ] **59.** Tap largo (500ms) en un botón ± abre el selector de incrementos con las opciones disponibles.
- [ ] **60.** Elegir un incremento distinto en el selector. El botón del numpad se actualiza. Al cerrar y reabrir el teclado, el cambio persiste.
- [ ] **61.** Cada fila de set ocupa ~56px de alto (contá visualmente: 3-4 sets ocupan ~224px, no ~320px de antes).
- [ ] **62.** La etiqueta TOP aparece en naranja/ámbar, BACK en azul, W en gris. Tap en la etiqueta cicla al siguiente tipo.
- [ ] **63.** Los valores de un set completado (✓ verde) tienen opacidad reducida y aparecen tachados.
- [ ] **64.** Botón "+ Serie" es compacto (40px alto, solo ícono + texto), no una banda full-width.
- [ ] **65.** Settings → Teclado (tab "Teclado") muestra sección de incrementos por equipo. Cambiar un valor, cerrar Settings, reabrir: el cambio persiste.
- [ ] **66.** PreSessionModal (abrir plantilla con toggle "Vista previa" ON) usa el mismo teclado custom al tapear un campo de peso.
- [ ] **67.** Timer flotante no choca con la tab bar inferior al hacer scroll.
- [ ] **68.** El teclado en desktop: tipear con teclado físico actualiza el campo. Tab/Enter avanza al siguiente campo. Escape cierra.
- [ ] **69.** Sin historial de incrementos guardados: los defaults por equipo se aplican correctamente.

---

## Si algo falla

1. **NO borres datos** — todo sigue respaldado en `IronSuiteDataV14_BACKUP_{fecha}` en localStorage
2. **NO ejecutes "Resetear toda la app"**
3. Anotá qué falló específicamente y mandalo para diagnóstico
4. Mientras tanto, los datos en Drive (si llegaste al Bloque 3) son tu segundo respaldo
