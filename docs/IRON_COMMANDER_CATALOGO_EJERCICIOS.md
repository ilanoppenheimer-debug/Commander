# Iron Commander — Catálogo de ejercicios y lógica de nombres
**v1.7 · 12 octubre 2026 · Sección 8 del Contrato YAML app ↔ Coach**

> Se agrega al documento "Iron Commander — Contrato YAML app ↔ Coach".
> El Coach se mueve por este catálogo. Si necesita un movimiento que no está, lo declara explícitamente en vez de inventar el nombre.
> **v1.5:** la app ya no distingue mayúsculas ni tildes (8.1). Se resuelve 8.3b: el catálogo adopta los nombres con historial real y suma los nuevos de 3A. Curl de Bíceps Bayesiano confirmado como ejercicio propio. Handstand sin "— Progresión".
> **v1.6:** Core Anti-extensión se retira como nombre de ejercicio (decisión del 8 oct); el ejercicio de core vigente es Plancha Abdominal.
> **v1.7:** 8.7 actualizado a las secciones actuales del CONTEXTO PARA COACH.

---

## 8.1 Por qué esto importa

**El nombre del ejercicio es lo único que segmenta el historial.** La app agrupa sets, volumen y 1RM estimado **por nombre**, no por equipo. El campo `equipo` sirve para el ícono y los incrementos del teclado: **no separa historiales**.

**Qué cuenta como "mismo nombre" (desde el 8 oct 2026):** la app compara **sin mayúsculas, sin tildes y sin espacios repetidos**. "Jalón al Pecho" y "Jalón al pecho" son el mismo ejercicio; "Curl de Bíceps Bayesiano" y "Curl de biceps bayesiano", también. **Cualquier otra diferencia crea un ejercicio nuevo**: "Remo con mancuerna" ≠ "Remo mancuerna"; "Curl de bicep con barra" ≠ "Curl de biceps con barra"; "Curl Femoral sentado" ≠ "Curl Femoral".

Consecuencia: cada vez que el mismo movimiento se escribe distinto (más allá de mayúsculas y tildes), nace un ejercicio nuevo con su propio historial y su propio 1RM. Caso real: el remo horizontal quedó repartido en **cuatro nombres** ("Remo Polea / Landmine", "Remo en Polea / Landmine", "Lanemine row", "Remo en Punta") con 17 sets fragmentados.

Origen del problema: **alternativas escritas dentro del nombre.** El slash de "Remo Polea / Landmine" convirtió una alternativa en identidad.

---

## 8.2 La regla

> **Dos entradas son el mismo ejercicio si un peso registrado en una es comparable con un peso registrado en la otra.**

Test de decisión, una sola pregunta:

> ¿Un peso registrado acá es comparable con uno registrado allá?
> **Sí** → mismo nombre. **No** → nombres distintos.

**"Transferible" no es "comparable".** Un movimiento puede servir de referencia para otro (el curl bayesiano informa al curl de bíceps) sin que sus pesos sean comparables. Si no son comparables, nombres distintos; el Coach usa uno como referencia del otro en su criterio, no en el historial.

### Al nombre SÍ va

- **El movimiento**: Press Banca, Remo, Sentadilla.
- **El implemento, cuando cambia la carga**: Press Banca ≠ Press Inclinado Mancuernas. Remo en Polea ≠ Remo con Landmine ≠ Remo en Punta (T-bar).
- **La palanca o el ángulo**: Press Banca Inclinado, Push-Ups Pies Elevados, Curl Femoral ≠ Curl femoral acostado.

### Al nombre NO va

| Qué | Dónde va | Ejemplo |
|---|---|---|
| **Técnica** | `nota_ejercicio` | "estricto", "tempo 3-1-1" |
| **Protocolo** | `nota_ejercicio` | "test máximo", "hold máximo", "AMRAP" |
| **Alternativas** | `nota_ejercicio` | "si no hay polea, landmine" |
| **Unilateral, si la carga es comparable** | `nota_ejercicio` | "unilateral, cada lado" |
| **Posición, si la máquina es la misma** | `nota_ejercicio` | "sentado" en el Curl Femoral de siempre |

**Nunca usar slashes en el nombre.** Una alternativa no es un ejercicio.

*Excepción ya registrada:* **Press Banca con Pausa** lleva la pausa en el nombre porque la pausa cambia la carga (no es comparable con la banca normal). Es la regla, no una contradicción: técnica que cambia la carga → nombre propio.

### Límite conocido: máquinas

La regla funciona limpio para **barra, mancuerna y peso corporal**: 100 kg es 100 kg en cualquier gimnasio.

**Para máquina y polea no.** "Prensa de Piernas" en un gimnasio y en otro no son comparables aunque el número coincida. Ponerle el gimnasio al nombre no resuelve nada.

- Para ejercicios de máquina, **el 1RM estimado es referencia débil y no debería usarse para decidir cargas.**
- Lo que sí sirve es la **progresión sesión a sesión en la misma máquina**.
- **Si se cambia de máquina, se anota en `nota_ejercicio`.** Ahí la serie se corta y el Coach lo interpreta.

---

## 8.3 Catálogo canónico

Nombres que el Coach puede usar, **tal cual**. Principio: **el Catálogo sigue a la app**; donde un nombre ya acumula historial, se adopta ese nombre. Las mayúsculas y tildes de esta tabla son las recomendadas, pero la app no las distingue.

### Piernas

| Canónico | Notas |
|---|---|
| **Peso Muerto** | Barra |
| **Sentadilla** | Barra |
| **Sentadilla Hack** | Máquina |
| **Sentadilla Péndulo** | Máquina, distinta de la hack |
| **Prensa de Piernas** | Máquina |
| **Prensa de piernas unilateral** | Máquina. No comparable con la bilateral |
| **Curl Femoral** | Máquina, sentado (el de siempre). "Sentado" no va al nombre |
| **Curl femoral acostado** | Máquina. Palanca distinta al sentado |
| **Extensiones de Cuádriceps** | Máquina |
| **Elevación de Gemelos** | Máquina |
| **RDL** | Barra. Peso muerto rumano |
| **Buenos Días** | Barra. Alterna con RDL como secundario de Legs |

### Empuje

| Canónico | Notas |
|---|---|
| **Press Banca** | Barra |
| **Press Banca con Pausa** | Barra. Pausa de 2-3 s en el pecho; carga no comparable con la banca normal. Nuevo en 3A (día DL) |
| **Press Banca Inclinado** | Barra |
| **Press Inclinado Mancuernas** | Mancuernas. Reemplaza a "Press Banca Inclinado Mancuernas" (0 usos) |
| **Press Militar** | Barra. Parkeado en 3A |
| **Extensión de Tríceps** | Polea |
| **Extensión tríceps katana** | Polea. Palanca distinta a la extensión en polea |
| **Extensión de Tríceps con Mancuerna** | Sobre la cabeza, una mancuerna. Nuevo en 3A |
| **Rompecráneos** | Barra (confirmar si alguna vez fue mancuerna) |
| **Cruce de Poleas** | Polea |
| **Push-Ups** | Peso corporal |
| **Push-Ups Pies Elevados** | Palanca distinta → nombre propio |

### Tirón

| Canónico | Notas |
|---|---|
| **Dominadas** | Peso corporal o lastradas. El lastre va en la columna Peso (PC + X) |
| **Jalón al Pecho** | Polea |
| **Jalón en Polea a una mano** | Polea |
| **Remo con Barra** | Barra. Fuera de 3A |
| **Remo mancuerna** | Mancuerna, apoyado en banco. **No** "Remo con mancuerna" |
| **Remo en Polea** | Absorbe "Remo Polea / Landmine", "Remo en Polea / Landmine", "Lanemine row" |
| **Remo con Landmine** | Implemento distinto → nombre propio |
| **Remo en Punta** | T-bar. Implemento distinto → nombre propio |
| **Pull-over con Polea** | Polea |
| **Curl de Bíceps** | Mancuerna |
| **Hammer curl** | Mancuernas, agarre neutro |
| **Curl de Bíceps con Barra** | Barra |
| **Curl de Bíceps en Polea** | Polea |
| **Curl de Bíceps Bayesiano** | Polea baja, banco detrás del punto de apoyo. **Ejercicio propio**: transferible como referencia al Curl de Bíceps, pero sus cargas no son comparables |

### Hombro y prevención

| Canónico | Notas |
|---|---|
| **Elevaciones Laterales** | Mancuerna |
| **Elevaciones laterales con polea** | Polea. Nombre propio: carga no comparable con mancuerna |
| **Facepull** | Polea alta |
| **Prevención — Manguito Rotador** | |
| **Prevención — Extensión de Muñeca** | |

### Core y calistenia

| Canónico | Notas |
|---|---|
| **Plancha Abdominal** | Medida en segundos. «Anti-extensión» es el patrón, no el ejercicio: otro ejercicio de core (rueda abdominal, dead bug) va con su propio nombre |
| **Handstand** | Medido en segundos. La variante (pared, paralelas, libre) va en la nota — ver 8.7 |
| **Tuck Front Lever** | Medido en segundos. "Hold máximo" es protocolo → nota |
| **Muscle-Up** | |
| **Cardio** | Medido en segundos, compañero FC. Modalidad en la nota |

---

## 8.3b Pendientes de decisión (8 octubre 2026)

*Lo resuelto el 5-8 oct ya está en la tabla de 8.3.*

| Tema | Estado |
|---|---|
| **"Curl de bicep con barra" (3 usos) vs "Curl de Bíceps con Barra"** | Difieren en "bicep/biceps": la app los trata como distintos. Usar **Curl de Bíceps con Barra** hacia adelante; los 3 sets viejos quedan separados salvo que el atleta los renombre en la app |
| **Otros ~20 nombres con historial** | Variantes de curl con barra, «Flexion de piernas», «V squat», «Pajaros rear delts», etc. Cada unificación se decide con el atleta y se hace con el renombre de la app; ninguna se aplica sola |

---

## 8.4 Duplicados a unificar

**El pasado queda fragmentado salvo que el atleta lo renombre en la app; lo que importa es que no nazcan nuevos.**

| Canónico | Absorbe | Estado |
|---|---|---|
| **Remo en Polea** | Remo Polea / Landmine · Remo en Polea / Landmine · Lanemine row | Fragmentado |
| **Extensión de Tríceps** | Extension de triceps *(sin tildes)* | **Unificado automáticamente** (8 oct) |
| **Jalón al Pecho** | Jalón al pecho *(minúscula)* | **Unificado automáticamente** (8 oct) |
| **Remo en Punta** | Remo en punta *(minúscula)* | **Unificado automáticamente** (8 oct) |
| **Press Militar** | Press Militar Estricto | Fragmentado |
| **Curl de Bíceps** | Hammer curwl *(typo)* | Fragmentado. Hammer curl es hoy ejercicio propio |
| **Curl de Bíceps** *(mancuerna, desde 27-ago)* | Historial previo mezclado con barra/polea/bayesiano bajo el mismo nombre | Corte hacia adelante, no se reconstruye |

**Se mantienen separados** (implemento o palanca distinta): Remo en Punta · Remo con Landmine · Press Inclinado Mancuernas · Push-Ups Pies Elevados · Curl de Bíceps con Barra · Curl de Bíceps en Polea · Curl de Bíceps Bayesiano · Curl femoral acostado · Elevaciones laterales con polea · Prensa de piernas unilateral.

---

## 8.5 Fuera del catálogo

Ejercicios usados una o dos veces y abandonados hace meses. Si el Coach quiere volver a usarlos, los declara explícitamente:

Abducción de piernas · Core Anti-extensión *(retirado el 8 oct; 11 usos hasta el 11-ago, el historial queda como está)* · Pájaros rear delts · V Squat · Remo en T con Apoyo · Press Banca Agarre Cerrado (sustituto documentado de la pausa si hay dolor costal) · Flexión de Piernas *(20 sets, sin uso desde mayo)*

---

## 8.6 Regla operativa para el Coach

1. **Usar los nombres del catálogo, tal cual están escritos.** Sin agregar "con", sin plurales distintos, sin descriptores de posición.
2. **Alternativas en `nota_ejercicio`**, nunca en el nombre. Nunca slashes.
3. **Técnica y protocolo en `nota_ejercicio`**, salvo que cambien la carga (8.2).
4. **Si hace falta un movimiento que no está en el catálogo**, declararlo explícitamente al proponerlo ("esto es un ejercicio nuevo, no está en tu catálogo").
5. **El nombre en inglés está permitido** si es el nombre real del movimiento (front lever, muscle-up, handstand, hammer curl). Lo que no se permite es la misma cosa escrita de dos formas.
6. **Para prescribir tiempo** (holds, cardio): escribir el tiempo en la columna de reps con formato `"25s"` o `"10min"`. Ver 8.7.
7. **La plantilla de fase también sigue el catálogo.** Un nombre que entra a la plantilla termina en un YAML.

---

## 8.7 Ejercicios medidos en tiempo — resuelto

Handstand, front lever, planchas y holds isométricos, más cardio, se registran con **tiempo estructurado** (segundos) en vez de peso/reps.

### Cómo funciona

Dos campos viven en la configuración del ejercicio en la app, por nombre:

- **`medición`**: `reps` (default) o `tiempo`.
- **`compañero`**: solo si `medición: tiempo`. `dificultad` (3 niveles, tipo semáforo) o `fc` (frecuencia cardíaca, ingresada a mano).

**El Coach nunca declara estos campos en el YAML.** Dos caminos:

1. **Vía import:** el Coach prescribe tiempo en la columna de reps (`"25s"`, `"10min"`). Si el ejercicio es nuevo, la app lo autoconfigura como Tiempo y lo muestra en el wizard con botón "Cambiar". Si ya tenía otra configuración, alerta en vez de sobreescribir.
2. **Vía chip manual:** para ejercicios agregados a mano en sesión activa.

### Qué ve el atleta

Una fila de registro de tiempo con timer dedicado: countdown de 5 s, cuenta ascendente, persistente contra que el navegador suspenda la pantalla. Al detener, el valor queda como sugerencia editable; el atleta confirma. Un tiempo sin confirmar no pasa a la sesión siguiente.

### Qué ve el Coach

El reporte de bloque, el export de sesión y el CONTEXTO PARA COACH muestran el tiempo real (ej. `42s`) más el compañero, sin línea "Plan:". En el CONTEXTO aparecen en "Últimos registros por ejercicio" (últimas 8 semanas), igual que el resto de los ejercicios no-main (Contrato §5). El volumen no incluye estos sets.

**La escala de dificultad mide qué tan difícil fue la variante o la ejecución, no la calidad técnica** (Esqueleto §5).

---

**Fin de la sección 8**
