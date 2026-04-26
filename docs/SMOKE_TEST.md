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

---

## Si algo falla

1. **NO borres datos** — todo sigue respaldado en `IronSuiteDataV14_BACKUP_{fecha}` en localStorage
2. **NO ejecutes "Resetear toda la app"**
3. Anotá qué falló específicamente y mandalo para diagnóstico
4. Mientras tanto, los datos en Drive (si llegaste al Bloque 3) son tu segundo respaldo
