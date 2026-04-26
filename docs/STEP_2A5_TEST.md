# STEP_2A5_TEST — Bug Fixes + Historial + UX Polish

## Bugs

- [ ] **1.** Click "Ver mi historial" al final del wizard de import → navega a tab Historial sin error en consola
- [ ] **2.** Console limpia: no hay warnings de `Encountered two children with the same key`
- [ ] **3.** Modal selector de ejercicios: overlay sólido (negro opaco), el modal cubre header y bottom nav, botón X visible, búsqueda funciona, crear ejercicio nuevo funciona (con botón en footer y en empty state)
- [ ] **4.** Modal "Misión Completada": overlay sólido, botón "Guardar en Historial" siempre visible aunque el análisis sea largo, sesión vacía muestra warning amarillo

## Historial

- [ ] **5.** Cards de historial muestran top set por ejercicio en formato `{peso}kg × {reps} @ RPE{rpe}`
- [ ] **6.** Click en una card (fuera del menú ⋯) abre el modal de detalle con todos los sets de todos los ejercicios
- [ ] **7.** Modal de detalle muestra `workoutNotes` si existen (sesiones importadas de Strong suelen tenerlas)
- [ ] **8.** Botón "Editar" en el modal de detalle abre el editor con banner de warning naranja
- [ ] **9.** En el editor se puede agregar/borrar ejercicios y series, y editar peso/reps/RPE
- [ ] **10.** Guardar cambios en el editor crea backup automático (Drive o local) y persiste. Toast "Cambios guardados".
- [ ] **11.** Cancelar el editor con cambios sin guardar muestra modal de confirmación "¿Descartar?"
- [ ] **12.** Botón Borrar en el modal de detalle → confirmación → backup automático → sesión eliminada → modal cerrado
- [ ] **13.** Filtro por nombre de sesión funciona (ej: buscar "Tarde" filtra sesiones con ese texto en el nombre)
- [ ] **14.** Filtro por ejercicio muestra solo sesiones que contienen ese ejercicio
- [ ] **15.** Filtro por período (ej: "Último mes") filtra correctamente por fecha
- [ ] **16.** Sort "Mayor volumen" ordena sesiones con más `peso × reps` primero. Verificar con al menos 2 sesiones de volumen conocido.

## UX

- [ ] **17.** Header muestra info contextual: sin sesión activa → "X sesiones · Última: {fecha}", con sesión activa → indicador verde pulsante "Sesión activa"
- [ ] **18.** La franja "FASE GLOBAL" solo aparece en tab Rutinas Y solo cuando la fase seleccionada no es "Modo Libre" (o cuando hay sesión activa). En tabs Historial, Placas y Fuerza nunca aparece.
- [ ] **19.** Bottom nav tiene 4 tabs: RUTINAS | HISTORIAL | PLACAS | FUERZA. No hay "Cargar" ni "Sumar" separados.
- [ ] **20.** Tab PLACAS muestra sub-tabs "Cargar" / "Sumar" que alternan entre TargetCalculator y ReverseCalculator correctamente.
- [ ] **21.** Timer flotante: al soltar después de arrastrar, se ancla automáticamente a la esquina más cercana con animación suave. Verificar las 4 esquinas.
- [ ] **22.** Posición del timer persiste tras recargar la página (se guarda en localStorage).

## Empty States

- [ ] **Rutinas vacías:** muestra 3 botones de acción (Importar texto / Generar con IA / Crear manual), no solo un mensaje de texto
- [ ] **Historial vacío (sin sesiones):** muestra botones "Importar Strong" y "Empezar a entrenar"
- [ ] **Tendencias vacías:** mensaje informativo, no error

---

## Notas de verificación

- La migración de `routine-1` solo corre si hay una plantilla con ese ID en Dexie (one-shot vía `localStorage.MIGRATED_ROUTINE_IDS_V2`)
- El backup pre-edit y pre-delete se crea siempre (Drive si está conectado, local si no)
- Las sesiones importadas de Strong tienen `historyId` que empieza con `strong-import-`
- El sort "mayor volumen" puede ser lento con >500 sesiones — si lagea, implementar `useMemo` en App.jsx
