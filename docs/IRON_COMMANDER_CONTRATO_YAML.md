# Iron Commander — Contrato YAML app ↔ Coach
**v1.6 · 12 octubre 2026** *(v1.3: 4 oct, una fase = un bloque. v1.4: 5 oct, header y notas de `backoff_pct` / `aplica_a`. v1.5: `backoff_pct` por ejercicio; back-off que sigue al top; identidad de nombres sin mayúsculas ni tildes; "Tiempo" es por ejercicio; 1RM por ventana móvil; se retira la limitación de orden. v1.6: secciones del CONTEXTO PARA COACH y "Enviar al Coach" (§5); ejemplo y caso de uso de `backoff_pct` de ejercicio alineados con la práctica del Coach.)*

> Documento de referencia única para el formato de rutinas que el Coach entrega y la app importa.
> Vive en dos lugares: el repo de la app (`docs/`) y el conocimiento del Project del Coach.
> Si algo cambia, se actualiza **acá**: no se re-explica por chat.

---

## Principio rector

**La app CALCULA y RECUERDA. El Coach PRESCRIBE, PIENSA y JUZGA.**

- La app **no sugiere** pesos ni targets propios.
- La app **no evalúa** el desempeño (no hay flags de "progresó/bajó").
- La app **calcula** lo que el Coach ya definió como regla (ej. back-off como % del top real).
- La app **recuerda**: es la única memoria persistente del sistema. El Coach es amnésico entre conversaciones.

Corolario práctico: si un campo no tiene una función concreta en la app, **no va al contrato**. El contrato mínimo es el mejor contrato.

---

## 1. Estructura general de una rutina

```
---
nombre: LEGS
fecha: 2026-07-19
foco: ...
duracion_min: 75
sesion_num: 14
bloque:
  ...
contexto: |
  ...
---

# CALENTAMIENTO
- ...

# EJERCICIO: Nombre del ejercicio
- equipo: barbell
- tag: main_lift
- superset: A
- descanso: 180s
- backoff_pct: 0.97
- nota_ejercicio: |
    ...

| Set | Tipo | Peso | Reps | RPE | Descanso |
|-----|------|------|------|-----|----------|
| 1 | warmup | 60 | 5 | - | 90s |
| 2 | top | 137.5 | 6 | 7.5–8 | 180s |

## Decisión adaptativa
- ...

# NOTAS DE CIERRE
...
```

**Regla crítica de formato:** el header **abre y cierra con `---`**. Todo el metadata (incluido `bloque:`) va **adentro** de esos separadores. Si el header no abre con `---`, el import falla con "Falta bloque YAML inicial".

**`nombre` de la sesión:** texto libre; la app agrupa el conteo por tipo según el prefijo del nombre (lo que va antes de `—`, `·`, `.` o `/`) y lo muestra tal como se escribió. Por eso va solo el día de rotación (`LEGS`, `TORSO`, `DL`, `ACCESORIOS`): cualquier otra cosa dentro del nombre fragmenta el conteo. La app no tiene concepto de "rotación": cuenta cada tipo por separado (ACCESORIOS aparece como un tipo más; excluirlo de la rotación es criterio del Coach).

---

## 2. Bloque (mesociclo)

Va **dentro** del header YAML, como un campo más.

```yaml
bloque:
  id: 3A                      # identidad estable del bloque
  nombre: Bloque 3A — Intensificación
  cierra: 2A                  # OPCIONAL — solo en la 1ª rutina del bloque nuevo
  tipo: intensification       # accumulation | hypertrophy | intensification | peaking | deload
  inicio: 2026-10-05
  aplica_a: [main_lift]
  fase: intensificacion       # texto libre; la app lo guarda tal cual
  params:
    reps_rango: [3, 6]
    rpe_rango: [7.5, 8.5]
    backoff_pct: 0.88
  semana: 1
```

### Reglas

| Regla | Detalle |
|---|---|
| **`id` estable** | Es la clave de identidad. Mismo `id` → la app **actualiza** el bloque existente. `id` nuevo → **crea** uno nuevo. Nunca se usa el `nombre` como clave (los nombres cambian). **Una fase = un bloque = un `id`.** Un cambio de fase abre un bloque nuevo (con `id` nuevo y `cierra`). Dentro de un bloque, todas las rutinas mandan el mismo `id`. Nunca ids derivados del anterior (`2A-T2`). |
| **`cierra`** | Opcional. Solo en la primera rutina de un bloque nuevo. Marca el bloque anterior como completado. Si el bloque referido no existe, la app avisa y sigue (no rompe). Un bloque completado o archivado **no se modifica** desde un import. |
| **`aplica_a` fijo** | Se define una vez al crear el bloque y **no se toca durante su vida**. Los `params` de reps y RPE se muestran como "Plan:" sobre todos los ejercicios cuyo tag esté en `aplica_a` (nunca sobre ejercicios medidos en tiempo). Si los params solo describen a los mains, usar `[main_lift]`. |
| **Cambio de fase → bloque nuevo** | Cada fase es un bloque con `id` propio. En la primera rutina del bloque nuevo se manda `cierra: <id anterior>`. El conteo de sesiones empieza de cero en cada bloque. **El 1RM estimado NO se reinicia:** ver §5. El REPORTE DE BLOQUE del bloque cerrado queda como informe de cierre. |
| **`fase`** | Texto libre (`intensificacion`, `fuerza_hipertrofia`, `calistenia`…). La app lo guarda tal cual, sin lista cerrada. Siempre texto, nunca un número. |
| **`params` parciales** | Se pueden mandar solo los params que cambian: la app **mezcla** con los guardados. Mandar solo `reps_rango` no borra el `backoff_pct` vigente. Un YAML sin `params` no toca los guardados. |
| **Campos ausentes** | Si algo no está definido con certeza, **se omite**. No se inventan defaults. |
| **`semana`** | La actualiza el Coach según sesiones ejecutadas reales, no calendario. |
| **`backoff_pct` (de bloque)** | Fracción del top **real** del día que la app usa para sugerir los sets `back`/`backoff`. Rango válido: **0.5 a 1.0** (fracción, no porcentaje: `0.88`, no `88`). Fuera de rango, el wizard avisa y el valor se ignora (se conserva el guardado; si no hay ninguno, 0.90). Es referencia: el atleta adapta al material disponible (incremento mínimo: 1 kg). Para un ejercicio puntual con otro porcentaje, ver `backoff_pct` de ejercicio (§3). |

### Qué hace la app al importar

1. Busca un bloque con ese `coachId`.
2. Si no existe → lo crea (`status: active`, `sessionsLogged: 0`).
3. Si existe → lo **actualiza** preservando: `sessionsLogged`, id interno, `startedAt`, `createdAt`. **Un import nunca resetea el conteo real de sesiones.**
4. Si viene `cierra: X` → marca X como completado.
5. Antes de escribir hace **backup automático**.
6. El wizard **muestra qué va a pasar** ("Bloque 3A: CREAR" / "ACTUALIZAR · semana 3") antes de confirmar. Nada ocurre en silencio.

---

## 3. Ejercicio

```
# EJERCICIO: Press Banca
- equipo: barbell
- tag: main_lift
- descanso: 180s
- backoff_pct: 0.97
- nota_ejercicio: |
    Top de 5 reps: el back es de 5 reps un punto de RPE más fácil.
```

### Nombre del ejercicio

Sale del **Catálogo**, siempre. La app identifica el ejercicio por nombre **ignorando mayúsculas, tildes y espacios repetidos** ("Curl de Bíceps Bayesiano" = "Curl de biceps bayesiano"). Cualquier otra diferencia ("con", plural, palabras de más, puntuación) es **otro ejercicio** para la app. Al importar, el wizard clasifica cada nombre:

- **Exacto** (igual salvo mayúsculas/tildes): se asigna solo al ejercicio existente.
- **Probable** (igual quitando además palabras vacías como "con", "de", "en"): preseleccionado, el atleta confirma.
- **Sin resolver**: el atleta elige; si no elige, se guarda como **ejercicio nuevo** con el nombre del Coach (historial nuevo, 1RM desde cero).

El matcher es una red de seguridad, no un reemplazo del Catálogo.

### `equipo`

Valores canónicos, **en inglés** (evita la ambigüedad de "barra": puede ser barbell o barra de dominadas):

`barbell` · `dumbbell` · `cable` · `machine` · `smith` · `kettlebell` · `bodyweight` · `other`

**Siempre especificar `equipo`.** Si se omite, la app asume `barbell` y muestra un aviso en el import. Para peso corporal es especialmente importante: sin `equipo: bodyweight`, las dominadas quedan registradas como barra.

El `equipo` que el Coach declara se guarda como el equipo por defecto del ejercicio y se usa para los incrementos del teclado. No separa historiales (eso lo hace el nombre — ver el Catálogo).

### `tag`
`main_lift` · `secondary` · `accessory` · `isolation` · `conditioning`

El `tag` es lo que conecta un ejercicio con el bloque activo: si el tag está en el `aplica_a` del bloque, ese ejercicio recibe el contexto del bloque en el reporte (`Plan: 3-6 reps, RPE 7.5-8.5`).

### `superset`

```
- superset: A
```

- Mismo valor = mismo grupo. Usar letras (A, B, C) por sesión.
- Si el ejercicio **no** va en superset, **omitir el campo** (no poner `superset: none`).
- Los ejercicios de un mismo superset **deben ir consecutivos** en la rutina.
- El detalle en prosa puede seguir en `nota_ejercicio` — el campo es para que la app lo entienda, la nota es para el atleta.

### `backoff_pct` (de ejercicio) — nuevo en v1.5

Opcional. Reemplaza al `backoff_pct` del bloque **solo para ese ejercicio en esa rutina**. Prioridad: **ejercicio > bloque > 0.90**.

- Mismo formato y rango que el de bloque: fracción entre 0.5 y 1.0. Fuera de rango → aviso en el wizard (si escribís `88`, sugiere "¿querías 0.88?") y se ignora.
- Caso de uso: un ejercicio puntual con otro % que el del bloque (ej. 0.97 cuando el top es de 5 reps). `1.0` sigue siendo válido (la app sugiere el back al mismo peso del top), pero el Coach no lo usa para el main liviano de las rotaciones A/B: desde el 9 oct esas series al mismo peso se escriben como `top` + `normal` (Esqueleto §3.7).
- Se guarda con la rutina y con la sesión. Es una prescripción de esa rutina, no una propiedad fija del ejercicio: la próxima rutina que no lo traiga vuelve al valor del bloque.
- El wizard lo muestra en el detalle del ejercicio ("Back-off: 100% del top (propio de este ejercicio)").

### `nota_ejercicio`
Texto libre. Es el canal para todo lo que **no** tiene un campo propio: estado de mantenimiento, sustituciones posibles, recordatorios técnicos, advertencias.

> **Por qué no hay campo `estado: mantenimiento`:** la app no tiene ninguna lógica que se comporte distinto según ese estado. Sería un campo que se parsea, se guarda y no hace nada. Va en `nota_ejercicio` hasta que exista un uso real que lo justifique.

Línea simple o bloque multilínea (`nota_ejercicio: |`): ambos funcionan.

---

## 4. Tabla de sets

| Set | Tipo | Peso | Reps | RPE | Descanso |
|-----|------|------|------|-----|----------|

### Tipos de set y qué hace la app con cada uno

| Tipo | De dónde saca el valor sugerido | Cuenta al volumen | Entra al 1RM |
|---|---|---|---|
| `warmup` | Viene del plan (la app no calcula) | **No** | **No** |
| `top` | Referencia histórica | Sí | Sí |
| `back` / `backoff` | Se **calcula** desde el top real del día × `backoff_pct` (de ejercicio o de bloque). Si hay varios `top`, usa el **último** | Sí | Sí |
| `normal` | Copia el último set del mismo ejercicio en esta sesión | Sí | Sí |
| `amrap` | Hereda el peso; **reps y RPE quedan vacíos a propósito** | Sí | Sí |
| `drop` | Sin lógica propia (no se usa en la práctica) | Sí | **No** |

Todos los valores sugeridos son **placeholders grises**: no se registran como datos hasta que el atleta los confirma.

**Back-off que sigue al top (v1.5):** el peso sugerido del back se recalcula cada vez que cambia el peso real del top, hasta que el atleta **escribe un peso en el back o confirma ese set**. Mirar o editar el RPE o las reps del back no lo congela. El back no se calcula desde el placeholder del top: hasta que el top tiene un peso real, el back queda vacío.

### Formatos que la app no parsea (pero no rompen)

- **Rangos de RPE** (`7.5–8`) → el set se importa, el RPE queda vacío.
- **Reps no numéricas** (`intento libre`) → el set se importa, las reps quedan vacías.

Son avisos esperados en el wizard, no errores. El atleta completa a mano.

**Reps con formato de duración (`"25s"`, `"10min"`):** la app las reconoce como tiempo. Si el ejercicio no tiene `medición` configurada todavía, lo autoconfigura como tipo Tiempo y lo muestra en el wizard con opción de corregir. Si ya está configurado de otra forma, genera una alerta: nunca sobreescribe en silencio. Esta configuración (`medición`, `compañero`) **vive en la app, no en el YAML**. Detalle en el Catálogo, sección 8.7.

---

## 5. Qué devuelve la app (reporte de sesión)

```
## Sentadilla [main_lift]
  Plan: 3-6 reps, RPE 7.5-8.5
  Bloque: Bloque 3A — Intensificación (5/…)
  Real:
    1. TOP     150 kg × 5 @ RPE 8
    2. BACK    132.5 kg × 5 @ RPE 7.5
  Volumen: 2412 kg·rep
  1RM est.: 191.5 kg (confianza alta, N=23) — referencia, no máximo del día
  Tiempo: 24 min
```

- **`PC`** en la columna de peso = peso corporal (bodyweight sin carga externa).
- **`Tiempo`** = minutos **de ese ejercicio**: desde que se cerró el ejercicio anterior (o desde el inicio de la sesión, para el primero) hasta que se cerró este. El del primer ejercicio incluye el calentamiento general.
- **1RM estimado**: confianza `alta` (N≥6) · `media` (N 3-5) · `baja` (N<3). Es **referencia**, no un máximo real del día.
  - Se calcula **por nombre de ejercicio** con una **ventana móvil de 12 semanas desde hoy**. **No se reinicia por bloque**: los sets del bloque anterior siguen dentro hasta que salen de la ventana. Consecuencia: al cambiar de fase, el 1RM mezcla sets de las dos fases durante ~12 semanas; un cambio de 1RM dentro del bloque nuevo no es progreso puro de ese bloque.
  - Un nombre nuevo (ej. Press Banca con Pausa) arranca con N=0.
  - N cuenta los sets válidos: sin warmup ni drop, peso > 0, reps 1-12, RPE ≥ 6, no marcados como incompletos, peso ≥ 50% del máximo del ejercicio en la ventana. Que N se repita entre dos reportes puede ser coincidencia: entran sets nuevos y salen viejos.
- **Volumen**: excluye warmups. Los sets bodyweight aportan 0 (no hay carga externa que multiplicar). Los sets de ejercicios con `medición: tiempo` también aportan 0.
- **`molestia reportada`**: única marca automática que queda. Es señal de seguridad, no evaluación de desempeño.
- Un ejercicio sin ningún set con datos **no aparece** en el reporte.
- Un ejercicio con `medición: tiempo` muestra el tiempo real (ej. `42s`) en vez de peso/reps, más el `compañero` configurado (dificultad o FC) como sufijo, y sin línea "Plan:".
- El orden de los ejercicios en el reporte es el orden de ejecución.

### Tiempos por ejercicio (reporte bajo demanda)

En el modal de Contexto, pestaña "Tiempos por ejercicio" (se copia aparte; no viaja en el CONTEXTO PARA COACH). Para main lifts y secundarios, sobre las últimas 8 apariciones válidas:

```
Sentadilla [main_lift] · 21 min (IQR 19–27) · 5,1 min/serie · n=8 · incluye calentamiento
Press Banca [secondary] · n=2
```

- Mediana con rango intercuartílico (IQR), y minutos por serie de trabajo (sin warmups).
- Se descartan los intervalos donde el ejercicio anterior no se cerró y los ejercicios en superset.
- Con menos de 3 apariciones válidas muestra solo `n`.
- Sirve para calibrar la duración de sesión (Esqueleto §3.8).

### CONTEXTO PARA COACH (v1.6)

Lo que el atleta pega al pedir una sesión. Secciones, en orden:

| Sección | Qué trae |
|---|---|
| **Última sesión** | Todos los ejercicios de la última sesión con su mejor set. "Ejercicios: N" cuenta los listados; si alguno no tiene datos, se aclara ("7 (1 sin datos, omitido)"). |
| **Top sets recientes (últimas 8 semanas)** | Solo main lifts (según el tag con que se hicieron). Mejor set = mayor peso; si empata, más reps; si empata, el más reciente. |
| **Últimos registros por ejercicio (últimas 8 semanas, sin main lifts)** | Una línea por ejercicio con su última aparición: sets de trabajo (máx. 4, "(+N)" si hay más), fecha y tipo de sesión, agrupados por tipo de sesión. Variantes de mayúsculas/tildes van juntas. Ejercicios de tiempo con su compañero. Si la última aparición de un ejercicio con lastre fue sin carga, se agrega la última con carga ("· con lastre: +10×6@8 (15-sep)"). |
| **Bloques activos** | Bloque, tipo, params, sesiones, fase, tags de `aplica_a`. |
| **Sesiones del bloque por tipo** | Conteo por tipo de sesión, tal como se escribe el nombre. La app no conoce la "rotación". |
| **Frecuencia** | Sesiones en 7 días, 14 días y total. |

*Retirada en v1.6:* la sección "Ejercicios de tiempo recientes" (la cubre "Últimos registros").

**Fuera de la ventana de 8 semanas** (un ejercicio que no se hace hace meses): el atleta lo manda a pedido con **"Enviar al Coach"**, desde el historial del ejercicio (Historial → Tendencias, o durante la sesión). Trae las últimas 6 apariciones, las variantes de nombre agrupadas, el equipo en cada línea si se mezcló (barra/mancuerna), y el 1RM estimado solo si el ejercicio es de barra o mancuerna.

---

## 6. Limitaciones conocidas

| Limitación | Estado |
|---|---|
| **Calistenia / holds por tiempo** | **Resuelto (agosto 2026).** Segundos estructurados, companion (dificultad de 3 niveles o FC), timer dedicado. Detalle en Catálogo 8.7. |
| **Peso base de máquina** | Máquinas con peso propio (hack squat, prensa): la convención de registro no está estandarizada. Comparar entre máquinas distintas no es válido aunque el número coincida. |
| **Nombres de ejercicios** | **Parcialmente resuelto (8 oct).** Mayúsculas y tildes ya no fragmentan el historial. Cualquier otra variación sí: el Catálogo sigue siendo obligatorio. Historial previo con variantes reales ("con", plural, typos) sigue separado. |

*Retirado en v1.5:* "Orden cronológico en el reporte". Verificado sobre 28 sesiones (backup del 7 oct): el orden coincide con el de ejecución en el 100%.

---

## 7. Rol del Coach como QA de datos

El Coach ve **solo el texto del reporte** (sin acceso a la app ni a su base de datos). Dentro de ese límite, puede y debe señalar **incoherencias que sugieran un error de registro o de cálculo**: volúmenes que no cuadran con peso × reps, ejercicios duplicados, sets vacíos donde debería haber datos, saltos imposibles de carga.

No puede detectar bugs de interfaz ni de persistencia. Pero las incoherencias en los datos exportados sí son visibles, y ya han servido para encontrar bugs reales: notas multilínea perdidas, el bloque fantasma `2A-T2`, el "Plan:" sobre isométricos, el nombre de sesión mal singularizado ("Leg"), un tiempo de hold que reaparecía en la sesión siguiente, y el back-off que quedaba fijo sobre el top anterior (reporte del 6 oct, todos corregidos al 8 oct).

---

**Fin del contrato v1.6**
