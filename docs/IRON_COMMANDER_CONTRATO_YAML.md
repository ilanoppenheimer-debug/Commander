# Iron Commander — Contrato YAML app ↔ Coach
**v1.8.4 · 23 noviembre 2026** *(v1.3: 4 oct, una fase = un bloque. v1.4: 5 oct, header y notas de `backoff_pct` / `aplica_a`. v1.5: `backoff_pct` por ejercicio; back-off que sigue al top; identidad de nombres sin mayúsculas ni tildes; "Tiempo" es por ejercicio; 1RM por ventana móvil. v1.6: secciones del CONTEXTO PARA COACH y "Enviar al Coach". v1.7: formato único; dónde se ve cada texto del Coach; rangos de RPE y plan por set; Top sets con último top y 1RM; sufijo "plan". v1.7.1: ejercicios por tiempo. v1.7.2: tipo de set y variantes de `máx s`; unilaterales por tiempo.)*

> **Qué cambió en v1.8 (taxonomía de ejercicios):**
> - El nombre es la **variante sin implemento**; el implemento va en `equipo` y **separa los números** (§3, Catálogo 8.1). Nombres nuevos: Catálogo 8.4.
> - `equipo` suma `landmine` y `band`; si falta, ya no se asume barra (§3).
> - Campo nuevo opcional **`familia:`** para ejercicios nuevos (§3).
> - **Unilateral** = un lado a la vez; **peso por mancuerna o por lado, nunca sumado** (§3).
> - 1RM y top sets por nombre **+ implemento**; formato "Curl de Bíceps · barra" (§5).
> - Línea `Tiempo superset` y ejemplo de sufijo en tiempos (§5). **Exportar ejercicios** como lista viva (§5).
>
> **v1.8.1 (17-nov, misma fecha):** el wizard reconoce nombres viejos (probable) y nombres de familia (variantes, con la más reciente preseleccionada); `equipo` sin distinguir mayúsculas; sugerencia de equipo por historial; `PC` / `PC+10` en Peso; prefijos de rol y sufijos de protocolo (`Prevención —`, `— Test Máximo`) van a la nota.
>
> **v1.8.2 (20-nov):** sección «Series por ejercicio» en el CONTEXTO PARA COACH (§5); todo el CONTEXTO muestra el nombre canónico del Catálogo.
>
> **v1.8.3 (22-nov):** un nombre con dos implementos **en la misma sesión** lleva siempre sufijo (reporte de sesión, «Última sesión», compartir sesión); línea «Fuera del bloque» en el CONTEXTO (§5).
>
> **v1.8.4 (23-nov):** `descanso` faltante → 90 s **con aviso**; `backoff` es sinónimo de `back`; nombre de familia sin historial → variante de la regla vieja (§3). Verificado con los tests automatizados.

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

**Formato único.** Los ejercicios van como secciones `# EJERCICIO:` con bullets y tabla, nunca como lista YAML (`ejercicios: - nombre: …`). Campos que **no existen** y la app ignora o rechaza: `ejercicios`, `descanso_seg`, `opcional`, `tiempo`, `nota`, `notas`. Lo opcional va en `nota_ejercicio`; el tiempo, en la columna Reps. `semana` va **dentro** de `bloque`. *(Caso real: la rutina TORSO del 15-oct llegó como lista YAML y no importó.)*

**`nombre` de la sesión:** texto libre; la app agrupa el conteo por tipo según el prefijo del nombre (lo que va antes de `—`, `·`, `.` o `/`) y lo muestra tal como se escribió. Por eso va solo el día de rotación (`LEGS`, `TORSO`, `DL`, `ACCESORIOS`): cualquier otra cosa dentro del nombre fragmenta el conteo. La app no tiene concepto de "rotación": cuenta cada tipo por separado.

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
| **`id` estable** | Es la clave de identidad. Mismo `id` → la app **actualiza** el bloque existente. `id` nuevo → **crea** uno nuevo. Nunca se usa el `nombre` como clave. **Una fase = un bloque = un `id`.** Un cambio de fase abre un bloque nuevo (con `id` nuevo y `cierra`). Dentro de un bloque, todas las rutinas mandan el mismo `id`. Nunca ids derivados del anterior (`2A-T2`). |
| **`cierra`** | Opcional. Solo en la primera rutina de un bloque nuevo. Marca el bloque anterior como completado. Si el bloque referido no existe, la app avisa y sigue. Un bloque completado o archivado **no se modifica** desde un import. |
| **`aplica_a` fijo** | Se define una vez al crear el bloque y **no se toca durante su vida**. Los `params` de reps y RPE se muestran como "Plan:" sobre todos los ejercicios cuyo tag esté en `aplica_a` (nunca sobre ejercicios medidos en tiempo). Si los params solo describen a los mains, usar `[main_lift]`. |
| **Cambio de fase → bloque nuevo** | Cada fase es un bloque con `id` propio. En la primera rutina del bloque nuevo se manda `cierra: <id anterior>`. El conteo de sesiones empieza de cero en cada bloque. **El 1RM estimado NO se reinicia:** ver §5. |
| **`fase`** | Texto libre. La app lo guarda tal cual. Siempre texto, nunca un número. |
| **`params` parciales** | Se pueden mandar solo los params que cambian: la app **mezcla** con los guardados. Un YAML sin `params` no toca los guardados. |
| **Campos ausentes** | Si algo no está definido con certeza, **se omite**. No se inventan defaults. |
| **`semana`** | La actualiza el Coach según sesiones ejecutadas reales, no calendario. |
| **`backoff_pct` (de bloque)** | Fracción del top **real** del día que la app usa para sugerir los sets `back`/`backoff`. Rango válido: **0.5 a 1.0** (`0.88`, no `88`). Fuera de rango, el wizard avisa y el valor se ignora (se conserva el guardado; si no hay ninguno, 0.90). Es referencia: el atleta adapta al material disponible (incremento mínimo: 1 kg). |

### Qué hace la app al importar

1. Busca un bloque con ese `coachId`.
2. Si no existe → lo crea (`status: active`, `sessionsLogged: 0`).
3. Si existe → lo **actualiza** preservando `sessionsLogged`, id interno, `startedAt`, `createdAt`. **Un import nunca resetea el conteo real de sesiones.**
4. Si viene `cierra: X` → marca X como completado.
5. Antes de escribir hace **backup automático**.
6. El wizard **muestra qué va a pasar** antes de confirmar. Nada ocurre en silencio.

---

## 3. Ejercicio

```
# EJERCICIO: Curl de Bíceps
- equipo: cable
- tag: isolation
- descanso: 90s
- nota_ejercicio: |
    A una mano, 12 por lado.
```

Ejercicio nuevo que no está en el Catálogo:

```
# EJERCICIO: Sentadilla Zercher
- familia: Sentadilla
- equipo: barbell
- tag: secondary
- descanso: 150s
```

### Nombre del ejercicio (taxonomía)

Sale del **Catálogo** (sección 8), siempre. Tres niveles: **familia** (agrupa y define el grupo muscular) → **variante** (= el nombre) → **implemento** (= `equipo`).

- **El nombre es la variante, sin implemento.** `Curl de Bíceps` + `equipo: barbell`, nunca "Curl de Bíceps con Barra". El mismo nombre con otro `equipo` es la misma variante con **números separados** (§5).
- La app compara nombres **ignorando mayúsculas, tildes y espacios repetidos**. Cualquier otra diferencia es otro ejercicio.
- **Nombres viejos** (v1.7 y antes): el wizard conoce las equivalencias (Catálogo 8.4) y los muestra como **probable**, con la variante nueva preseleccionada y el equipo sugerido ("Press Inclinado Mancuernas" → Press Inclinado + dumbbell). Igual hay que usar los nombres nuevos: la equivalencia es una red de seguridad.
- **Nombre de familia** ("Curl Femoral", "Front Lever", "Cardio"): el wizard ofrece solo las variantes de esa familia, con la usada más recientemente preseleccionada. Sin historial, preselecciona la variante de la equivalencia vieja (Catálogo 8.4), salvo que sea solo-historial; si no hay, ninguna. Mejor escribir la variante.
- **Rol o protocolo en el nombre** (`Prevención — Manguito Rotador`, `Dominadas — Test Máximo`): el wizard lo quita, resuelve el resto y pasa ese texto a la nota. Mejor escribirlo directamente en `nota_ejercicio`.
- **Nombre desconocido** (ej. un ejercicio nuevo): sale **sin resolver** con sugerencias; si el atleta no elige, nace un ejercicio nuevo con historial vacío.
- Al importar, el wizard clasifica cada nombre: **Exacto** (se asigna solo), **Probable** (preseleccionado, el atleta confirma), **Sin resolver** (el atleta elige; si no, se guarda como ejercicio nuevo con historial desde cero). El matcher es una red de seguridad, no un reemplazo del Catálogo.

### `equipo`

Valores canónicos, **en inglés**:

`barbell` · `dumbbell` · `cable` · `machine` · `smith` · `kettlebell` · `landmine` · `band` · `bodyweight`

Se aceptan sin distinguir mayúsculas (`Landmine` = `landmine`), pero **solo en inglés**: `mancuernas` o `barra` son valores desconocidos (quedan sin definir, con aviso). `other` existe pero no tiene equivalente en la app: evitarlo.

**Siempre especificar `equipo`.** Es lo que separa los números dentro de una variante (1RM, top sets, último registro). Si se omite (o el valor es desconocido), la app **no asume barra**: el ejercicio queda con implemento sin definir, el wizard avisa ("queda sin definir") y, si el ejercicio tiene historial, sugiere el último implemento usado. Sin `equipo`, los números se calculan por nombre, mezclando implementos. Con `bodyweight` la carga es el lastre (columna Peso). En peso corporal y en ejercicios por tiempo el implemento no separa números.

El `equipo` también define los incrementos del teclado y el ícono.

### `familia` — nuevo en v1.8

Opcional, **solo para ejercicios que no están en el Catálogo**:

```
- familia: Sentadilla
```

- Ubica el ejercicio en el selector y le asigna el **grupo muscular de la familia**.
- Se compara sin mayúsculas ni tildes con las familias existentes (`SENTADILLA` → Sentadilla).
- Si no coincide con ninguna, la app crea una **familia nueva** (lo avisa en el import) y queda sin grupo muscular hasta que el atleta lo elija. Revisar la ortografía: "Sentadila" crea una familia nueva.
- **Nunca pisa** la familia de un ejercicio que ya la tiene (del Catálogo, elegida por el atleta o de un import anterior). En ejercicios del Catálogo, el campo se ignora.
- Un YAML sin `familia:` funciona igual que antes.

### Unilateral y registro del peso — nuevo en v1.8

- **Unilateral = un lado a la vez.** Mancuernas simultáneas son **bilaterales**.
- En un unilateral, **reps y peso son por lado**: una serie = ambos lados hechos. `3 × 10` = tres series de 10 por lado.
- **El peso se anota por mancuerna** (o por lado en polea a un brazo), **nunca sumado.** Prescribir igual: press con mancuernas `30` = 30 kg cada una.
- La app sabe qué variante es unilateral (y con qué implemento) por su tabla y por lo que configura el atleta (Catálogo 8.3 y 8.6). **No se declara en el YAML**: el campo `unilateral` se acepta pero no tiene efecto. Una ejecución distinta a la habitual va en `nota_ejercicio`.

### `tag`
`main_lift` · `secondary` · `accessory` · `isolation` · `conditioning`

El `tag` conecta un ejercicio con el bloque activo: si está en el `aplica_a` del bloque, ese ejercicio recibe el contexto del bloque en el reporte (`Plan: 3-6 reps, RPE 7.5-8.5`).

### `superset`

```
- superset: A
```

- Mismo valor = mismo grupo. Letras (A, B, C) por sesión.
- Si el ejercicio **no** va en superset, **omitir el campo**.
- Los ejercicios de un mismo superset **deben ir consecutivos**.
- El detalle en prosa puede seguir en `nota_ejercicio`.

### `backoff_pct` (de ejercicio)

Opcional. Reemplaza al `backoff_pct` del bloque **solo para ese ejercicio en esa rutina**. Prioridad: **ejercicio > bloque > 0.90**.

- Mismo formato y rango que el de bloque. Fuera de rango → aviso en el wizard (si escribís `88`, sugiere "¿querías 0.88?") y se ignora.
- Caso de uso: un ejercicio puntual con otro % (ej. 0.97 cuando el top es de 5 reps). `1.0` es válido, pero las series al mismo peso del main liviano se escriben como `top` + `normal` (Esqueleto §3.7).
- Es prescripción de esa rutina, no propiedad del ejercicio: la próxima rutina que no lo traiga vuelve al valor del bloque.

### `nota_ejercicio`
Texto libre para todo lo que **no** tiene campo propio: mantenimiento, sustituciones, técnica, protocolo, advertencias. Línea simple o bloque multilínea (`nota_ejercicio: |`).

### `descanso`
Siempre presente (`180s`, `90s`, `2min`). **Si falta, la app asume 90 s y lo avisa en el wizard.** En un superset cuenta el del **último** ejercicio del grupo.

## 3b. Dónde ve el atleta cada texto del Coach

En la sesión activa todo aparece **plegado**: el atleta lo abre cuando lo necesita.

| Texto del YAML | Dónde se ve en la sesión |
|---|---|
| `contexto` (header) | Fila "Plan del Coach ▸" al tope de la sesión |
| `# NOTAS DE CIERRE` | Fila "Plan del Coach ▸", debajo del contexto |
| `nota_ejercicio` | Chip "Coach ▸" del ejercicio |
| `## Decisión adaptativa` (bajo un ejercicio) | Chip "Coach ▸" del ejercicio, debajo de la nota |
| `# CALENTAMIENTO` | **No se muestra** |
| Tabla de sets (plan) | Chip "Objetivo ▸" del ejercicio (resumen por tipo de set, sin warmups) |

Regla práctica: las reglas de un ejercicio van en `## Decisión adaptativa` de ese ejercicio; las de la sesión (recortes por tiempo, prioridades si falta tiempo) van en `contexto`.

---

## 4. Tabla de sets

| Set | Tipo | Peso | Reps | RPE | Descanso |
|-----|------|------|------|-----|----------|

### Tipos de set y qué hace la app con cada uno

| Tipo | De dónde saca el valor sugerido | Cuenta al volumen | Entra al 1RM |
|---|---|---|---|
| `warmup` | Viene del plan (la app no calcula) | **No** | **No** |
| `top` | Referencia histórica | Sí | Sí |
| `back` (o su sinónimo `backoff`) | Se **calcula** desde el top real del día × `backoff_pct`. Si hay varios `top`, usa el **último** | Sí | Sí |
| `normal` | Copia el último set del mismo ejercicio en esta sesión | Sí | Sí |
| `amrap` | Hereda el peso; **reps y RPE quedan vacíos a propósito** | Sí | Sí |
| `drop` | Sin lógica propia | Sí | **No** |

Todos los valores sugeridos son **placeholders grises**: no se registran como datos hasta que el atleta los confirma.

**Plan por set.** Al importar, Peso, Reps y RPE de la tabla se guardan además como **plan** del set (rangos incluidos). Si el atleta los cambia, el plan no se pierde. Prioridad del RPE mostrado: valor real > RPE planificado (o límite inferior del rango) > cálculo de la app.

**Back-off que sigue al top:** el peso sugerido del back se recalcula cada vez que cambia el peso real del top, hasta que el atleta **escribe un peso en el back o confirma ese set**. Hasta que el top tiene un peso real, el back queda vacío.

### Peso

Número en kg (`137.5`). En peso corporal: **`PC`** sin lastre y **`PC+10`** (o `PC + 10`) con 10 kg de lastre, igual que lo muestra el reporte. Con mancuernas, el peso de **una** mancuerna.

### Formatos que la app no parsea (pero no rompen)

- **Rangos de RPE** (`7.5–8`, también con `-` o `—`) → el **límite inferior** se muestra como placeholder (`@7.5`) y el rango completo queda en el plan del set.
- **Reps no numéricas** (`intento libre`) → el set se importa, las reps quedan vacías.
- **`máx` a secas en un ejercicio de repeticiones** → se importa como **AMRAP** (con aviso).

**Reps con formato de duración (`"25s"`, `"10min"`):** la app las reconoce como tiempo. Si el ejercicio no tiene `medición` configurada, lo autoconfigura como Tiempo y lo muestra en el wizard con opción de corregir. Si ya está configurado de otra forma, alerta: nunca sobreescribe en silencio. `medición` y `compañero` **viven en la app, no en el YAML** (Catálogo 8.8).

### 4b. Ejercicios por tiempo (holds, isométricos, cardio)

El tiempo va en la columna **Reps**. Es el **objetivo** del set: cuenta regresiva en pantalla completa, aviso sonoro y vibración al llegar. Al pasar el objetivo la cuenta sigue ("+0:06") y se guarda el **tiempo real total**.

| Escribís en Reps | Qué hace la app |
|---|---|
| `38s`, `45seg`, `10min` | Objetivo fijo: cuenta regresiva desde ese tiempo. |
| `30-40s`, `1-2min` | Rango: la cuenta regresiva usa el **límite inferior**; la pantalla muestra "obj 30-40 s". |
| `máx s` | **Máximo esfuerzo por tiempo**: sin objetivo, cronómetro hacia arriba, con el último registro como referencia. Tipo de set: `normal`. Acepta también `máx seg`, `max s`, `máx sec`, `Máx. s`. El protocolo va en `nota_ejercicio`. |
| `máx` a secas | **Máximo de repeticiones (AMRAP).** Nunca en un hold. |

**Reglas:**
- **Indicá siempre el tiempo en cada hold.** Si falta, la app usa el mejor tiempo de la última sesión (o 30 s si no hay historial): una progresión implícita fuera de tu prescripción.
- **Unilaterales por tiempo:** **un set por lado** (`3 × 30s por lado` = 6 sets alternados).
- El atleta puede ajustar el objetivo en el momento (±15 s, o ±1 min desde 3 min). No modifica tu plan.
- Un set agregado por el atleta copia el tiempo objetivo del anterior, pero no forma parte del plan.

---

## 5. Qué devuelve la app (reporte de sesión)

```
## Sentadilla [main_lift]
  Plan: 3-6 reps, RPE 7.5-8.5
  Bloque: Bloque 3A — Intensificación (9 sesiones)
  Real:
    1. TOP     150 kg × 5 @ RPE 8
    2. BACK    132.5 kg × 5 @ RPE 7.5
  Volumen: 2412 kg·rep
  1RM est.: 191.5 kg (confianza alta, N=23) — referencia, no máximo del día
  Tiempo: 24 min
```

- **Nombre con implemento:** cuando un nombre tiene más de un implemento en el período del reporte, se muestra como **"Curl de Bíceps · barra"**, y sus números (1RM, top sets, último registro) son de ese implemento. Con un solo implemento en el período, sale el nombre a secas. **Si el mismo nombre aparece con dos implementos en una sesión** (ej. Elevaciones Laterales con polea en un superset y con mancuerna en otro), esa sesión siempre los separa: `Elevaciones Laterales · polea` / `· mancuerna`.
- **`PC`** en la columna de peso = peso corporal sin carga externa.
- **`Tiempo`** = minutos **de ese ejercicio**: desde que se cerró el anterior (o el inicio de la sesión) hasta que se cerró este. El primero incluye el calentamiento general.
- **Supersets:** cada miembro lleva `[superset A]` en el encabezado y el grupo tiene **una sola línea de tiempo**, en el primer miembro: `Tiempo superset A (2 ejercicios): 7 min` (desde el cierre del ejercicio anterior hasta el último cierre del grupo). Las letras se regeneran por orden de aparición en la sesión, no son las del YAML. Si falta algún cierre, la línea se omite.
- **1RM estimado**: confianza `alta` (N≥6) · `media` (N 3-5) · `baja` (N<3). Es **referencia**, no un máximo del día.
  - Se calcula **por nombre + implemento** con una **ventana móvil de 12 semanas**. **No se reinicia por bloque.** Historial viejo sin implemento cuenta para cualquier implemento. En peso corporal y tiempo no se separa por implemento.
  - Un nombre nuevo arranca con N=0.
  - N cuenta los sets válidos: sin warmup ni drop, peso > 0, reps 1-12, RPE ≥ 6, no incompletos, peso ≥ 50% del máximo del ejercicio en la ventana.
- **Volumen**: peso × reps, sin warmups. Bodyweight y ejercicios por tiempo aportan 0. **Con mancuernas y en unilaterales el peso es por mancuerna / por lado**, así que el volumen en kg de esos ejercicios está subestimado (no se multiplica ×2). Para comparar entre ejercicios, usar series, no kg.
- **`molestia reportada`**: única marca automática. Es señal de seguridad, no evaluación.
- Un ejercicio sin ningún set con datos **no aparece**.
- Ejercicios con `medición: tiempo`: tiempo real (ej. `42 s`) más el `compañero` como sufijo, sin línea "Plan:".
- El orden de los ejercicios es el orden de ejecución.
- **Sufijo `· plan …`:** si lo real se aparta del plan, el set lleva lo planificado al lado: `BACK 92.5 kg × 5 @ RPE 8 · plan 94×5 @8`. Un RPE dentro del rango cuenta como cumplido. Los warmups nunca llevan sufijo. Es descripción, no evaluación. **En tiempos:** `NORMAL 9 min · plan 10min`; con compañero: `25 s · Media · plan 38s`. Un tiempo dentro del rango no lleva sufijo. `máx s` nunca lleva sufijo.
- Las notas del atleta salen como `Nota ejercicio:` / `Nota set N:`.

### Tiempos por ejercicio (reporte bajo demanda)

En el modal de Contexto, pestaña "Tiempos por ejercicio". Para main lifts y secundarios, sobre las últimas 8 apariciones válidas:

```
Sentadilla [main_lift] · 21 min (IQR 19–27) · 5,1 min/serie · n=8 · incluye calentamiento
Press Banca [secondary] · n=2
```

- Mediana con IQR, y minutos por serie de trabajo.
- Se descartan los intervalos donde el ejercicio anterior no se cerró y los ejercicios en superset.
- Con menos de 3 apariciones válidas muestra solo `n`.

### CONTEXTO PARA COACH

Lo que el atleta pega al pedir una sesión. Todos los nombres salen con la grafía canónica del Catálogo, aunque el historial tenga otra. Secciones, en orden:

| Sección | Qué trae |
|---|---|
| **Última sesión** | Todos los ejercicios de la última sesión con su mejor set. |
| **Top sets recientes (últimas 8 semanas)** | Solo main lifts. Por lift (e implemento, si en esas 8 semanas hubo más de uno, como "Press Banca · mancuerna"): **mejor** set y **último** top; debajo, el **1RM estimado** con N, confianza y "ventana 12 semanas". |
| **Últimos registros por ejercicio (últimas 8 semanas, sin main lifts)** | Una línea por ejercicio (e implemento, si en esas 8 semanas hubo más de uno; los de tiempo nunca se separan) con su última aparición: sets de trabajo (máx. 4), fecha y tipo de sesión. Ejercicios de tiempo con su compañero. Si la última aparición de un ejercicio con lastre fue sin carga, se agrega la última con carga. |
| **Bloques activos** | Bloque, tipo, params, sesiones, fase, tags de `aplica_a`. |
| **Sesiones del bloque por tipo** | Conteo por tipo de sesión. Debajo, **«Fuera del bloque»**: sesiones desde el inicio del bloque que no quedaron asociadas a él porque no tienen ningún ejercicio con tag de `aplica_a` (hoy, las ACCESORIOS), con conteo y última fecha. Solo lectura. |
| **Series por ejercicio (sin warmups, completadas)** | Conteo crudo de series por ejercicio en dos ventanas hacia atrás desde que se genera el contexto: **7 días** y **8–14 días**. Separado en **Split** (LEGS / TORSO / DL), **ACCESORIOS** y **Otras**. Serie = no warmup, no marcada incompleta y con datos (reps, peso o segundos). Sin reglas de planificación: incluye skills y cardio; un hold unilateral por tiempo cuenta por fila (un set por lado = 2). El implemento aparece solo si hubo más de uno en la ventana. **La app no agrupa por músculo**: el agrupamiento lo hace el Coach con su Plantilla. Sin sesiones en 14 días, lo dice explícitamente. |
| **Frecuencia** | Sesiones en 7 días, 14 días y total. |

**Fuera de la ventana de 8 semanas:** el atleta lo manda a pedido con **"Enviar al Coach"** desde el historial del ejercicio (últimas 6 apariciones, equipo en cada línea, 1RM si es barra o mancuerna).

### Exportar ejercicios — nuevo en v1.8

En Ajustes → Datos. Es la **lista viva** de ejercicios: Familia → variante → implementos, grupo muscular de la familia, unilateral, cuáles tienen historial (●) y cuántas sesiones, más los ejercicios propios del atleta. Úsenlo cuando el Coach necesite confirmar un nombre o un implemento, o al planificar una fase nueva.

---

## 6. Limitaciones conocidas

| Limitación | Estado |
|---|---|
| **Holds unilaterales por tiempo** | **Abierto.** Un set guarda un solo tiempo: prescribir un set por lado (§4b). |
| **Peso base de máquina** | Máquinas con peso propio (hack, prensa): la convención no está estandarizada. Comparar entre máquinas distintas no es válido aunque el número coincida. |
| **Volumen en kg con mancuernas y unilaterales** | **Abierto (nov 2026).** El peso es por mancuerna / por lado y el volumen no lo multiplica. Comparaciones de volumen en kg entre implementos no son válidas. |
| **Nombres de ejercicios** | **Resuelto (nov 2026)** con la taxonomía: historial renombrado, implemento separado del nombre, catálogo en la app. El Catálogo sigue siendo obligatorio: un nombre fuera de él crea un ejercicio nuevo. |

---

## 7. Rol del Coach como QA de datos

El Coach ve **solo el texto del reporte**. Dentro de ese límite, puede y debe señalar **incoherencias que sugieran un error de registro o de cálculo**: volúmenes que no cuadran con peso × reps, ejercicios duplicados, sets vacíos donde debería haber datos, saltos imposibles de carga, un implemento que no corresponde al ejercicio.

No puede detectar bugs de interfaz ni de persistencia. Pero las incoherencias en los datos exportados sí son visibles, y ya han servido para encontrar bugs reales (notas multilínea perdidas, el bloque fantasma `2A-T2`, el "Plan:" sobre isométricos, el back-off fijo sobre el top anterior, la duración de los supersets).

---

**Fin del contrato v1.8.4**
