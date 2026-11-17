# Iron Commander — Catálogo de ejercicios y lógica de nombres
**v2.0 · 17 noviembre 2026 · Sección 8 del Contrato YAML app ↔ Coach (v1.8)**

> Se agrega al documento "Iron Commander — Contrato YAML app ↔ Coach".
> El Coach se mueve por este catálogo. Si necesita un movimiento que no está, lo declara explícitamente y lo manda con `familia:` (8.5).
> **v2.0 (taxonomía):** el catálogo se reorganiza en **familia → variante → implemento**. Los nombres ya no llevan el implemento (va en `equipo`). La app separa los números por nombre **e** implemento. Muchos nombres cambiaron: ver la tabla de equivalencias (8.4). La lista viva está en la app (Ajustes → Datos → **Exportar ejercicios**); este documento fija las reglas.

---

## 8.1 Cómo identifica la app un ejercicio

Tres niveles:

| Nivel | Qué es | Para qué sirve | Ejemplo |
|---|---|---|---|
| **Familia** | Grupo de variantes que el Coach intercambia entre sí | Agrupa en el selector y **define el grupo muscular** | Curl de Bíceps |
| **Variante** | El **nombre** del ejercicio | Identidad: historial, 1RM, top sets | Curl Bayesiano |
| **Implemento** | El campo `equipo` | **Separa los números** dentro de la variante | `barbell` / `dumbbell` / `cable` |

- **El nombre es la variante, sin implemento.** "Curl de Bíceps" con `equipo: dumbbell` y "Curl de Bíceps" con `equipo: barbell` son la misma variante con números separados (1RM, top sets, último registro). Nunca "Curl de Bíceps con Barra": eso es otro nombre y nace un ejercicio nuevo.
- **Comparación de nombres:** sin mayúsculas, sin tildes y sin espacios repetidos. Cualquier otra diferencia ("con", plural, palabras de más) es otro ejercicio.
- **Excepciones al implemento:** en **peso corporal** y en **ejercicios por tiempo** el implemento no separa números. En peso corporal la carga es el lastre (columna Peso).
- **Historial viejo sin implemento** cuenta para cualquier implemento de esa variante.
- En los reportes, cuando una variante tiene más de un implemento, la app lo muestra como **"Curl de Bíceps · barra"**.

---

## 8.2 La regla

> **Misma variante** si un peso registrado en una sirve de referencia directa para la otra (mismo movimiento, misma palanca). El implemento distinto **no** crea variante: lo resuelve `equipo`.
> **Misma familia** si el Coach las intercambia en la programación.
> **Variante propia** cuando cambia el ángulo, la palanca o el lado de forma significativa: Press Inclinado ≠ Press Banca; Curl Femoral Acostado ≠ Sentado; Prensa de Piernas Unilateral ≠ Prensa de Piernas; Sentadilla Hack ≠ V Squat.

### Al nombre NO va

| Qué | Dónde va | Ejemplo |
|---|---|---|
| **Implemento** | `equipo` | barra, mancuernas, polea |
| **Técnica / protocolo** | `nota_ejercicio` | "estricto", "tempo 3-1-1", "test máximo", "hold máximo" |
| **Alternativas** | `nota_ejercicio` | "si no hay polea, landmine". **Nunca slashes en el nombre.** |
| **Posición, si la máquina es la misma** | `nota_ejercicio` | — |

*Excepción vigente:* **Press Banca con Pausa** lleva la pausa en el nombre porque cambia la carga.

### Máquinas
Para máquina y polea el peso no es comparable entre gimnasios. El 1RM de máquina es referencia débil; lo útil es la progresión sesión a sesión en la misma máquina. Un cambio de máquina se anota en `nota_ejercicio`.

---

## 8.3 Catálogo canónico (16-nov-2026)

Nombres que el Coach usa **tal cual**. Columna Implementos: los que la app ofrece para esa variante (en el YAML van en inglés, ver tabla de valores al final). **Unilateral** según 8.6. ● = con historial.

### Piernas

| Familia | Variante | Implementos | Unilateral |
|---|---|---|---|
| Sentadilla | ● **Sentadilla** | barra, multipower | |
| | **Sentadilla Frontal** | barra, multipower | |
| | **Sentadilla Goblet** | mancuerna, kettlebell | |
| | ● **Sentadilla Hack** | máquina | |
| | ● **Sentadilla Péndulo** | máquina | |
| | ● **V Squat** | máquina | |
| | **Sissy Squat** | peso corporal, máquina | |
| Split Squat | **Sentadilla Búlgara** | mancuerna, barra, multipower, peso corporal | sí |
| Prensa | ● **Prensa de Piernas** | máquina | |
| | ● **Prensa de Piernas Unilateral** | máquina | sí |
| Peso Muerto | ● **Peso Muerto** | barra | |
| RDL | ● **RDL** | barra, mancuerna, multipower | |
| | ● **Buenos Días** | barra, multipower | |
| | **Buenos Días en Hack** | máquina | |
| | **Buenos Días en V Squat** | máquina | |
| | **RDL en Belt Squat** | máquina | |
| Hip Thrust | ● **Hip Thrust** | barra, máquina, mancuerna, peso corporal | |
| Curl Femoral | ● **Curl Femoral Sentado** | máquina | |
| | ● **Curl Femoral Acostado** | máquina | |
| | **Nordic Curl** | peso corporal | |
| Extensión de Cuádriceps | ● **Extensión de Cuádriceps** | máquina | |
| Abducción | ● **Abducción de Piernas** | máquina | |
| Gemelos | ● **Elevación de Gemelos** | máquina | |
| Tibial Anterior | **Tibial Anterior** | sin definir | |

### Pecho

| Familia | Variante | Implementos | Unilateral |
|---|---|---|---|
| Press Banca | ● **Press Banca** | barra, mancuerna, multipower | |
| | ● **Press Banca con Pausa** | barra | |
| | ● **Press Banca Agarre Cerrado** | barra | |
| Press Inclinado | ● **Press Inclinado** | barra, mancuerna, multipower | |
| Aperturas | ● **Aperturas** | polea, mancuerna | |
| Flexiones | ● **Push-Ups** | peso corporal (lastre) | |
| | **Push-Ups en Paralelas** | peso corporal (lastre) | |
| Flexiones Declinadas | ● **Decline Push-Ups** | peso corporal (lastre) | |
| | ● **Decline Push-Ups en Paralelas** | peso corporal (lastre) | |

### Espalda

| Familia | Variante | Implementos | Unilateral |
|---|---|---|---|
| Dominadas | ● **Dominadas** | peso corporal (lastre) | |
| Muscle-Up | ● **Muscle-Up** | peso corporal (lastre) | |
| Jalón | ● **Jalón al Pecho** | máquina, polea | |
| | ● **Jalón a una mano** | polea, máquina | sí |
| Remo | ● **Remo con Barra** | barra | |
| | ● **Remo Mancuerna** | mancuerna | sí |
| | ● **Remo en Polea** | polea | |
| | ● **Remo Landmine** | landmine | sí |
| | ● **Remo en T con apoyo** | máquina, landmine | |
| Pull-over | **Pull-over con Polea** | polea | |
| Front Lever | ● **Front Lever Tuck** | peso corporal · tiempo | |
| | ● **Front Lever Advanced Tuck** | peso corporal · tiempo | |
| | **Front Lever One Leg** | peso corporal · tiempo | |
| | **Front Lever Full** | peso corporal · tiempo | |
| | **Front Lever con Ayuda** | peso corporal · tiempo | |

### Hombros

| Familia | Variante | Implementos | Unilateral |
|---|---|---|---|
| Press Militar | ● **Press Militar** | barra, mancuerna | |
| | **Press Militar Sentado** | barra, mancuerna, máquina | |
| Elevaciones Laterales | ● **Elevaciones Laterales** | mancuerna, polea, máquina | con polea |
| Elevaciones Frontales | ● **Reverse Front Fly** | polea | sí |
| Pájaros | ● **Pájaros** | polea, mancuerna | con polea |
| Facepull | ● **Facepull** | polea | |
| Encogimientos | ● **Encogimientos** | máquina, barra, mancuerna | |
| Manguito Rotador | ● **Rotación Externa** | polea, banda, mancuerna | sí |
| | ● **Rotación Interna** | polea, banda, mancuerna | sí |
| Handstand | ● **Handstand** | peso corporal · tiempo | |
| | ● **Handstand en Paralelas** | peso corporal · tiempo | |

*Reverse Front Fly:* deltoides anterior, agarre supino, polea. No es Pájaros (posterior).

### Brazos

| Familia | Variante | Implementos | Unilateral |
|---|---|---|---|
| Curl de Bíceps | ● **Curl de Bíceps** | barra, mancuerna, polea | con polea |
| | ● **Curl Bayesiano** | polea | sí |
| | ● **Hammer Curl** | mancuerna, polea | con polea |
| | **Curl Predicador** | barra, mancuerna, máquina | |
| Extensión de Tríceps | ● **Extensión de Tríceps** | polea | sí (polea) |
| | ● **Extensión Tríceps Katana** | polea | sí |
| | ● **Rompecráneos** | barra, mancuerna | |
| Muñeca | ● **Extensión de Muñeca** | mancuerna, barra, polea | sí |
| | ● **Flexión de Muñeca** | mancuerna, barra, polea | sí |

*Rompecráneos:* acostado, a la frente (skullcrusher), con barra o mancuernas. No hay extensión de tríceps sobre la cabeza con mancuerna en el catálogo.

### Core

| Familia | Variante | Implementos | Unilateral |
|---|---|---|---|
| Core | ● **Plancha** | peso corporal · tiempo | |
| | **Plancha Lateral** | peso corporal · tiempo | sí |
| | **Crunch Abdominal** | peso corporal, polea, máquina | |
| | **Knee Raises** | peso corporal | |
| | **Leg Raises** | peso corporal | |
| | **Ab Wheel** | peso corporal | |
| | **Dragon Flag** | peso corporal | |

### Cardio

| Familia | Variante | Implementos |
|---|---|---|
| Cardio | ● **Bicicleta** | máquina · tiempo |
| | **Trotadora** | máquina · tiempo |
| | **Elíptica** | máquina · tiempo |
| | **Escalera** | máquina · tiempo |

*Cardio (sin especificar)* existe solo como historial (21 sesiones); no se prescribe. La modalidad va en el nombre.

### Solo historial (no se prescriben)

**Cardio (sin especificar)** · **Remo Polea / Landmine (sin resolver)**. Aparecen en los reportes con sus datos viejos.

*Manguito Rotador* (genérico, 2 sesiones) sigue existiendo en la familia, pero hacia adelante se prescribe **Rotación Externa** o **Rotación Interna**.

### Valores de `equipo` (YAML)

| En la app | En el YAML |
|---|---|
| barra | `barbell` |
| mancuerna | `dumbbell` |
| polea | `cable` |
| máquina | `machine` |
| multipower | `smith` |
| kettlebell | `kettlebell` |
| landmine | `landmine` |
| banda elástica | `band` |
| peso corporal (con o sin lastre) | `bodyweight` |

Se aceptan sin distinguir mayúsculas, pero **solo en inglés**. Un valor desconocido queda sin definir (con aviso). En peso corporal, la columna Peso lleva `PC` o `PC+10` (lastre).

---

## 8.4 Equivalencias: nombres viejos → nombres nuevos

El historial ya se renombró en la app (10-nov). **Hacia adelante solo se usan los nombres de la derecha.** El wizard conoce estas equivalencias: un nombre viejo sale como **probable**, con la variante nueva preseleccionada y el equipo sugerido. Es una red de seguridad, no un permiso: el Coach usa los nombres nuevos.

| Nombre viejo (Catálogo v1.7 o historial) | Nombre nuevo | `equipo` |
|---|---|---|
| Curl Femoral · Flexión de Piernas | **Curl Femoral Sentado** | machine |
| Curl femoral acostado | **Curl Femoral Acostado** | machine |
| Extensiones de Cuádriceps | **Extensión de Cuádriceps** | machine |
| Prensa de piernas unilateral | **Prensa de Piernas Unilateral** | machine |
| Abducción de piernas | **Abducción de Piernas** | machine |
| Press Banca Inclinado | **Press Inclinado** | barbell |
| Press Inclinado Mancuernas | **Press Inclinado** | dumbbell |
| Press banca agarre cerado | **Press Banca Agarre Cerrado** | barbell |
| Press Militar Estricto | **Press Militar** | barbell |
| Cruce de Poleas | **Aperturas** | cable |
| Push-Ups Pies Elevados | **Decline Push-Ups** | bodyweight |
| Push-Ups Pies Elevados + Paralelas | **Decline Push-Ups en Paralelas** | bodyweight |
| Jalón en Polea a una mano · Jalon al pecho unilateral | **Jalón a una mano** | cable |
| Remo mancuerna | **Remo Mancuerna** | dumbbell |
| Remo en Punta · Remo con Landmine | **Remo Landmine** | landmine |
| Remo Polea / Landmine · Remo en Polea / Landmine | **Remo en Polea** (hacia adelante) | cable |
| Curl de Bíceps con Barra · Curl de bicep(s) con barra | **Curl de Bíceps** | barbell |
| Curl de Bíceps en Polea | **Curl de Bíceps** | cable |
| Curl de Bíceps Bayesiano | **Curl Bayesiano** | cable |
| Hammer curl | **Hammer Curl** | dumbbell |
| Extensión tríceps katana | **Extensión Tríceps Katana** | cable |
| Extensión de Tríceps con Mancuerna | **Rompecráneos** | dumbbell |
| Elevaciones laterales con polea | **Elevaciones Laterales** | cable |
| Pájaros rear delts | **Pájaros** | cable |
| Encogimientos de Hombros | **Encogimientos** | machine |
| Prevención — Manguito Rotador · Rotaciones internas/externas de hombro | **Rotación Externa** / **Rotación Interna** | cable |
| Prevención — Extensión de Muñeca · Extensión de muñecas | **Extensión de Muñeca** | cable |
| Curl de Muñeca | **Flexión de Muñeca** | cable |
| Plancha Abdominal · Core Anti-extensión | **Plancha** | bodyweight |
| Tuck Front Lever | **Front Lever Tuck** | bodyweight |
| Handstand en Paralelas — Hold Máximo | **Handstand en Paralelas** (protocolo → nota) | bodyweight |
| Dominadas — Test Máximo | **Dominadas** (protocolo → nota) | bodyweight |
| Cardio | **Bicicleta / Trotadora / Elíptica / Escalera** | machine |

---

## 8.5 Ejercicio que no está en el catálogo

1. Declararlo al proponerlo ("ejercicio nuevo, no está en tu catálogo").
2. Nombre = la variante, sin implemento, sin slashes.
3. Agregar **`- familia: <Familia>`** en el ejercicio del YAML (Contrato §3) con una familia existente de este catálogo. Con eso la app lo ubica en el selector y le asigna el grupo muscular de la familia.
4. Si no pertenece a ninguna familia, omitir `familia:` o declarar una nueva: la app la crea y el atleta le asigna el grupo.

---

## 8.6 Unilateral y registro del peso

**Unilateral = un lado a la vez** (el otro lado descansa o espera). **Mancuernas simultáneas son bilaterales.**

- En un ejercicio unilateral, **reps y peso son por lado**: `3 × 10 @ 15 kg` = tres series de 10 por lado, 15 kg en cada lado. Una serie = ambos lados hechos.
- **El peso se anota por mancuerna** (o por lado en polea a un brazo), **nunca sumado**: press con dos mancuernas de 30 kg → `30`.
- Algunas variantes son unilaterales **solo con un implemento**: el Curl de Bíceps con polea es a una mano; con barra o mancuernas es bilateral (ver columna Unilateral en 8.3).
- La app sabe qué es unilateral por su tabla y por lo que configura el atleta. **El Coach no lo declara en el YAML**; si la prescripción es distinta a lo habitual, va en `nota_ejercicio`.
- **Holds por tiempo unilaterales:** un set por lado (Contrato §4b).

---

## 8.7 Regla operativa para el Coach

1. **Nombres de 8.3, tal cual.** Sin "con", sin implemento, sin descriptores de posición.
2. **`equipo` siempre**, en inglés (tabla de 8.3). Es lo que separa los números.
3. **Alternativas, técnica y protocolo en `nota_ejercicio`**, salvo que cambien la carga.
4. **Ejercicio nuevo:** declararlo y mandar `familia:` (8.5).
5. **Nombre en inglés** permitido si es el nombre real (front lever, muscle-up, handstand, hammer curl, push-ups). Lo que no se permite es la misma cosa escrita de dos formas.
6. **Tiempo** en la columna Reps (`"25s"`, `"10min"`, `máx s`). Ver 8.8 y Contrato §4b.
7. **La plantilla de fase también sigue el catálogo.** Un nombre que entra a la plantilla termina en un YAML.
8. **Ante la duda, pedir al atleta el export** (Ajustes → Datos → Exportar ejercicios): es la lista viva, con implementos, unilateral y qué tiene historial.

---

## 8.8 Ejercicios medidos en tiempo

Handstand, front lever, planchas, holds isométricos y cardio se registran en **segundos** en vez de peso/reps.

Dos campos viven en la configuración del ejercicio en la app:
- **`medición`**: `reps` o `tiempo`. Las variantes de tiempo del catálogo ya vienen configuradas.
- **`compañero`**: con `tiempo`, `dificultad` (3 niveles) o `fc` (frecuencia cardíaca a mano).

**El Coach nunca declara estos campos en el YAML.** Prescribe el tiempo en Reps; si el ejercicio es nuevo, la app lo autoconfigura como Tiempo y lo muestra en el wizard; si ya tenía otra configuración, alerta en vez de sobreescribir.

**Qué ve el Coach:** el tiempo real (ej. `42 s`) más el compañero, sin línea "Plan:", y el sufijo de plan cuando se aparta (`25 s · Media · plan 38s`). El volumen no incluye estos sets. La escala de dificultad mide qué tan difícil fue la variante o la ejecución, no la calidad técnica (Esqueleto §5).

---

**Fin de la sección 8**
