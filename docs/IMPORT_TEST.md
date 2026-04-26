# IMPORT_TEST — Strong App CSV Import Checklist

Ejecutar manualmente después de cada cambio al pipeline de importación.

---

## Pre-condiciones

- Tener el CSV exportado desde Strong app (ej: `strong7007247598680340041.csv`)
- App corriendo en localhost con Dexie limpio (o al menos sin sesiones de Strong previas)
- Conectar Google Drive si se quiere testear el backup a Drive

---

## Checklist

- [ ] **1. CSV se carga sin errores**
  - Ir a Settings → Datos → Importar desde Strong
  - Subir el CSV
  - Debe mostrar "X sesiones encontradas, Y sets totales" sin pantalla de error
  - Verificar que X coincide con el número de workouts distintos en Strong

- [ ] **2. Parser detecta el número correcto de workouts**
  - Cruzar el número de sesiones mostrado con el conteo en Strong app
  - Strong muestra el total de entrenamientos en el perfil
  - Tolerancia: ±1 por posibles workouts en progreso o sin guardar

- [ ] **3. Pesos se redondean correctamente**
  - Buscar en el CSV un peso como `31.751465900000003`
  - Después del import, verificar en Historial que ese set aparece con `31.75` kg
  - Otro caso: `24.947580350000003` → debe ser `25.00` (más cercano a múltiplo de 0.25)
  - Verificar también que `220.0` permanece `220` (sin distorsión)

- [ ] **4. Pull Up split por peso funciona**
  - Buscar en el CSV sesiones con "Pull Up" con peso > 0
  - Ese ejercicio debe aparecer en el historial como "Dominadas Lastradas"
  - Buscar sesiones con "Pull Up" con peso = 0
  - Ese ejercicio debe aparecer como "Dominadas"
  - Mismo test para "Dip" → "Fondos Lastrados" / "Fondos en Paralelas"

- [ ] **5. Notas duplicadas se consolidan**
  - Buscar en el CSV un workout donde `Workout Notes` tiene una nota (ej: "PM")
  - Esa nota se repite en cada fila del mismo workout en Strong
  - Después del import, la sesión debe tener la nota a nivel workout
  - Los sets individuales no deben repetir la misma nota

- [ ] **6. Ejercicios desconocidos aparecen en Pantalla 2**
  - Si hay ejercicios en el CSV que no están en `STRONG_EXERCISE_MAPPING`
  - La pantalla 2 debe mostrarlos con contador de apariciones
  - Verificar que el botón "Continuar" está deshabilitado hasta decidir qué hacer con cada uno
  - Testear las 3 opciones: mapear a existente, agregar como custom, ignorar

- [ ] **7. Top 8 rutinas detectadas son razonables**
  - Verificar que los nombres sugeridos coinciden con rutinas reales que entrenabas
  - Ej: si hacías Sentadilla + Peso Muerto frecuente → debe aparecer "Pierna A" y "Pierna B"
  - Al menos las top 3 deben ser claramente identificables
  - Si una rutina tiene < 5 sesiones no debe aparecer

- [ ] **8. Plantillas creadas tienen los ejercicios correctos**
  - Seleccionar 2-3 rutinas en el wizard
  - Después del import, ir a Rutinas y verificar que aparecen
  - Los ejercicios de cada plantilla deben corresponder a los más frecuentes de esa rutina
  - Las reps sugeridas deben ser un promedio razonable (no 0 ni valores absurdos)

- [ ] **9. Re-importar el mismo CSV detecta duplicados**
  - Con sesiones ya importadas, subir el mismo CSV nuevamente
  - En Pantalla 4 debe aparecer el warning "Detecté X sesiones ya importadas"
  - Opción "Saltar duplicados": el import debe agregar 0 sesiones nuevas
  - Opción "Importar todas de nuevo": el total de sesiones en historial debe duplicarse

- [ ] **10. Backup pre-import aparece en Drive**
  - Conectar Google Drive antes del import
  - Después del import exitoso, ir a Settings → Datos → Google Drive
  - Debe haber un backup nuevo con timestamp reciente
  - Si Drive no estaba conectado, verificar que se descargó un archivo .json localmente

- [ ] **11. Contador de Settings refleja sesiones nuevas**
  - Antes del import, anotar el número de "Sesiones" en la sección Base de Datos
  - Después del import, recargar Settings → Datos
  - El número debe haber aumentado en la cantidad importada

- [ ] **12. Historial muestra sesiones importadas con fechas correctas**
  - Ir a tab Historial
  - Las sesiones de Strong deben aparecer con sus fechas originales
  - Verificar que una sesión específica (ej: 2024-12-05) aparece con esa fecha
  - Las sesiones deben estar ordenadas de más reciente a más antigua

- [ ] **13. Una sesión específica tiene los sets correctos**
  - Elegir una sesión conocida en Strong (ej: 2024-12-05 — Deadlift 220kg × 3 reps)
  - Encontrar esa sesión en el historial de Iron Commander
  - Verificar: ejercicio = "Peso Muerto", weight = 220, reps = 3, RPE = 9.5
  - Verificar que los 4 sets del Deadlift están todos presentes
  - Verificar que otros ejercicios de esa sesión (Pull Up, Curl) también están

- [ ] **14. Custom exercises aparecen en el selector**
  - Si se mapeó algún ejercicio como "custom" durante el import
  - Crear una nueva sesión y abrir el selector de ejercicios
  - El ejercicio custom debe aparecer en la lista (con ícono de trash para eliminarlo)

- [ ] **15. Si el import falla a mitad de camino, los datos previos siguen intactos**
  - Probar desconectando la red justo después de que empiece el import
  - O modificar temporalmente `importer.js` para lanzar un error después de 5 sesiones
  - Verificar que la transacción Dexie hizo rollback (el historial no cambió)
  - Verificar que el mensaje de error muestra "Tus datos previos están intactos"

---

## Casos borde adicionales

- CSV con una sola sesión: debe funcionar
- CSV con un ejercicio completamente desconocido y elegir "Ignorar": esos sets no deben aparecer
- Sesión con todos los sets con reps = 0: esa sesión debe ser descartada silenciosamente
- Workout notes vacío: no debe generar errores ni notas vacías visibles

---

## Notas de referencia

- `31.751465900000003` → `Math.round(31.751465900000003 * 4) / 4 = 31.75`
- `24.947580350000003` → `Math.round(24.947580350000003 * 4) / 4 = 25.0`
- `18.143694800000002` → `Math.round(18.143694800000002 * 4) / 4 = 18.25`
- Prefijo de historyId para sesiones Strong: `strong-import-{workoutId}`
