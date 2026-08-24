import { useState, useRef, useEffect } from 'react';
import { CheckCircle2, Circle, X as XIcon, StickyNote, Play, Square, XCircle, Pencil } from 'lucide-react';
import { formatSeconds } from '../../utils/formatters';
import { NoteModal } from './NoteModal';
import { SecondsNumPad } from '../keypad/SecondsNumPad';

// Duplicated from SetRow.jsx rather than imported — SetRow.jsx is not touched in this
// phase (explicit constraint), so its unexported local constants aren't reachable here.
const TYPE_STYLES = {
  top:     'bg-amber-500/20 border-amber-500/50 text-amber-300',
  backoff: 'bg-slate-700/40 border-slate-600 text-slate-400',
  back:    'bg-slate-700/40 border-slate-600 text-slate-400',
  warmup:  'bg-slate-700/50 border-slate-500 text-slate-300',
  drop:    'bg-purple-500/25 border-purple-500 text-purple-300',
  amrap:   'bg-rose-500/25 border-rose-500 text-rose-300',
};

const TYPE_LABELS = {
  top: 'TOP', backoff: 'BACK', warmup: 'W', drop: 'DROP', amrap: 'AMRAP',
};

const COUNTDOWN_SECONDS = 5;

const DIFFICULTY_LEVELS = [
  { value: '1', className: 'bg-emerald-500 border-emerald-400' },
  { value: '2', className: 'bg-amber-500 border-amber-400' },
  { value: '3', className: 'bg-red-500 border-red-400' },
];

const hasRealValue = (v) => {
  const n = parseFloat(v);
  return !isNaN(n) && n > 0;
};

/**
 * TimedSetRow — hermano de SetRow, mismo grid (56px, 7 columnas) para ejercicios con
 * measurement === 'time'. En vez de weight/reps/rpe: segundos (con timer propio,
 * countdown 5s + conteo ascendente) y un campo "compañero" condicional (difficulty
 * semáforo o FC), según lo que devuelva getCompanion(ex.name) en el padre.
 *
 * El timer sobrevive que el navegador suspenda la pestaña (el atleta suelta el
 * teléfono durante el hold): copia el patrón de persistencia de AdvancedTimer.jsx
 * (no el componente) — se persiste un timestamp de inicio en localStorage, y todo
 * cálculo de tiempo transcurrido se hace por diferencia contra Date.now() al leer,
 * nunca contando ticks de setInterval (que se pausan solos en background). Al
 * detener, el valor no se escribe solo: queda como placeholder gris (mismo
 * renderField real→placeholder→— que SetRow) hasta que el atleta lo confirma —
 * igual que AdvancedTimer, ese estado "detenido sin confirmar" no persiste (se
 * limpia de localStorage al tocar stop), solo countdown/running.
 *
 * Confirmar vs. descartar: tocar la celda grande de segundos (donde se ve el
 * placeholder) CONFIRMA — es el target más grande y obvio de la fila, así que es
 * el que tiene que coincidir con la intención de "aceptar lo que estoy viendo".
 * El botón de control chico, en este mismo estado, hace lo opuesto: descarta y
 * vuelve a idle para reintentar. Antes era al revés (control confirmaba, la celda
 * descartaba) — eso causaba que se guardara companionValue sin seconds cuando el
 * atleta tocaba la celda grande creyendo que confirmaba.
 *
 * Clave de persistencia = exerciseId + setIndex (no hay id estable por set en el
 * modelo de datos actual). Si el set se borra o se reordena mientras el timer está
 * corriendo, la key puede quedar huérfana o apuntar a otro set al recargar — caso
 * borde aceptado, no hay id de set más estable para anclar esto hoy.
 */
export const TimedSetRow = ({
  set, setIndex, exerciseId, companion,
  onToggleCompleted, onUpdateField, onCycleType, onDelete, onSaveNote,
}) => {
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showSecondsPad, setShowSecondsPad] = useState(false);

  // idle | countdown | running | pending | editing
  const [phase, setPhase] = useState('idle');
  const [pendingSeconds, setPendingSeconds] = useState(null);
  const [hrEditing, setHrEditing] = useState(false);
  const [hrDraft, setHrDraft] = useState('');
  const [, setTick] = useState(0);

  const startedAtRef = useRef(null); // ms; fijo desde el tap de play hasta stop/cancel
  const storageKey = `ironcmdr_timedset_timer_${exerciseId}_${setIndex}`;

  const isDone   = !!set?.completed;
  const type     = set?.type && set.type !== 'normal' ? set.type : null;
  const tagStyle = type ? (TYPE_STYLES[type] || TYPE_STYLES.warmup) : null;
  const tagLabel = type ? (TYPE_LABELS[type] || type.toUpperCase().slice(0, 4)) : null;
  const hasNote  = !!(set?.notes && set.notes.trim().length > 0);

  const fieldBtnClass = isDone
    ? 'bg-emerald-950/30 border border-emerald-800/30 cursor-pointer'
    : 'bg-slate-900/60 hover:bg-slate-900 active:bg-slate-800 border border-slate-800';

  // stoppedAt is only written when the timer moves into 'pending' — its presence is
  // what tells the restore effect below which phase to reconstruct.
  const persistTimer = (startedAt, stoppedAt) => {
    try { localStorage.setItem(storageKey, JSON.stringify(stoppedAt ? { startedAt, stoppedAt } : { startedAt })); } catch {}
  };
  const clearPersisted = () => {
    try { localStorage.removeItem(storageKey); } catch {}
  };

  // ── Restore from localStorage on mount — same idiom as AdvancedTimer's restore
  // effect: read persisted real timestamps, derive phase/value purely from them, never
  // from a stored count. 'pending' is reconstructed the same way 'running' always was —
  // from two real clock readings, not from a persisted pendingSeconds number — because a
  // stored derived value can't be trusted the way a stored moment in time can. ──
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (stored?.startedAt && stored?.stoppedAt) {
        const secs = Math.max(0, Math.floor((stored.stoppedAt - stored.startedAt) / 1000 - COUNTDOWN_SECONDS));
        setPendingSeconds(secs);
        setPhase('pending');
      } else if (stored?.startedAt) {
        startedAtRef.current = stored.startedAt;
        const elapsed = (Date.now() - stored.startedAt) / 1000;
        setPhase(elapsed < COUNTDOWN_SECONDS ? 'countdown' : 'running');
        setTick(t => t + 1);
      }
    } catch {
      clearPersisted();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Wake-up on tab/app returning to foreground (same idiom as AdvancedTimer) ──
  useEffect(() => {
    const handler = () => { if (document.visibilityState === 'visible') setTick(t => t + 1); };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // ── Timer ticking (250ms) — only drives re-renders; the actual elapsed value is
  // always recomputed from Date.now() - startedAtRef, never from a tick counter, so a
  // throttled/suspended interval in the background can't desync the displayed value. ──
  useEffect(() => {
    if (phase !== 'countdown' && phase !== 'running') return;
    const interval = setInterval(() => setTick(t => t + 1), 250);
    return () => clearInterval(interval);
  }, [phase]);

  const getElapsedTotal = () => {
    if (!startedAtRef.current) return 0;
    return (Date.now() - startedAtRef.current) / 1000;
  };
  const getCountdownLeft = () => Math.max(0, Math.ceil(COUNTDOWN_SECONDS - getElapsedTotal()));
  const getRunningSeconds = () => Math.max(0, Math.floor(getElapsedTotal() - COUNTDOWN_SECONDS));

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (getElapsedTotal() >= COUNTDOWN_SECONDS) setPhase('running');
  }); // runs every render while ticking; only acts once real elapsed time crosses COUNTDOWN_SECONDS

  const startTimer = () => {
    const startedAt = Date.now();
    startedAtRef.current = startedAt;
    setPhase('countdown');
    persistTimer(startedAt);
  };

  const handleControlTap = () => {
    if (phase === 'idle') {
      // Reusa window.confirm — mismo patrón ya usado en BlockEditModal.jsx / DataBackupTab.jsx
      // para gates sí/no puntuales, en vez de armar un modal propio para este caso.
      if (hasRealValue(set?.seconds) && !window.confirm('Ya hay un tiempo confirmado para este set. ¿Reiniciar el timer y reemplazarlo?')) {
        return; // cancelar no toca nada — seconds, phase y storage quedan exactamente como estaban
      }
      startTimer();
      return;
    }
    if (phase === 'countdown') { startedAtRef.current = null; setPhase('idle'); clearPersisted(); return; } // cancel
    if (phase === 'running') {
      const secs = getRunningSeconds(); // reads startedAtRef.current — must run before it's nulled below
      persistTimer(startedAtRef.current, Date.now()); // keeps pending alive across a remount, see restore effect
      setPendingSeconds(secs);
      startedAtRef.current = null;
      setPhase('pending');
      return;
    }
    if (phase === 'pending') {
      // Descarta — el control chico ya no confirma, ver handleDisplayTap.
      setPendingSeconds(null);
      setPhase('idle');
      clearPersisted();
    }
  };

  const handleDisplayTap = () => {
    if (phase === 'pending') {
      // Confirma — la celda grande es el target obvio para "aceptar lo que veo".
      onUpdateField('seconds', String(pendingSeconds));
      setPendingSeconds(null);
      setPhase('idle');
      clearPersisted();
      return;
    }
    // Manual entry — the timer stays reachable via the control button (Play icon),
    // which still calls startTimer() unchanged in handleControlTap's 'idle' branch.
    // Both branches below open the same SecondsNumPad — 'editing' just keeps the
    // phase (and its Pencil control icon) so it's visible which mode the row is in
    // while the sheet is open.
    if (phase === 'idle' && !hasRealValue(set?.seconds)) { setShowSecondsPad(true); return; }
    if (phase === 'idle' && hasRealValue(set?.seconds)) { setPhase('editing'); }
  };

  // Closes the seconds pad regardless of which path opened it.
  const handleCloseSecondsPad = () => {
    setShowSecondsPad(false);
    if (phase === 'editing') setPhase('idle');
  };

  const commitHr = () => {
    setHrEditing(false);
    const n = parseFloat(hrDraft);
    if (!isNaN(n) && n > 0) onUpdateField('companionValue', hrDraft);
  };

  // Completing is the athlete's explicit "I'm done" signal — it implicitly stops
  // whatever the timer is doing and confirms the real elapsed value in the same
  // gesture, same idiom as SetRow's historical-placeholder-commit-on-complete.
  // 'pending' already has a stopped, stable value sitting on screen; 'running' gets
  // stopped right here instead of requiring a separate tap first. A mistaken tap is
  // recoverable via 'editing' (tap the seconds cell to correct), so this doesn't need
  // to be as conservative as it would without that correction path.
  const handleCompleteTap = () => {
    if (!isDone && phase === 'pending') {
      onUpdateField('seconds', String(pendingSeconds));
      setPendingSeconds(null);
      setPhase('idle');
      clearPersisted();
    } else if (!isDone && phase === 'running') {
      onUpdateField('seconds', String(getRunningSeconds()));
      startedAtRef.current = null;
      setPhase('idle');
      clearPersisted();
    }
    onToggleCompleted();
  };

  // ── Seconds cell content ─────────────────────────────────────────────────────
  // 'editing' has no cell content of its own anymore — it falls through to the
  // hasRealValue branch below (true by construction: editing is only entered when a
  // real value already exists), showing the confirmed value while SecondsNumPad
  // handles the actual correction as an overlay.
  let secondsContent;
  if (phase === 'countdown') {
    secondsContent = <span className="text-accent-400 font-black text-lg tabular-nums">{getCountdownLeft()}</span>;
  } else if (phase === 'running') {
    secondsContent = <span className="text-accent-400 font-bold tabular-nums">{formatSeconds(getRunningSeconds())}</span>;
  } else if (phase === 'pending') {
    secondsContent = (
      <span className="text-slate-500 italic font-normal text-xs">{formatSeconds(pendingSeconds)}</span>
    );
  } else if (hasRealValue(set?.seconds)) {
    secondsContent = (
      <span className={isDone ? 'text-slate-500' : 'text-slate-100'}>{formatSeconds(parseInt(set.seconds, 10))}</span>
    );
  } else {
    secondsContent = <span className="text-slate-700 font-normal">—</span>;
  }

  // ── Control icon (advances the timer state machine) ─────────────────────────
  // 'pending' shows a discard icon now, not a confirm check — confirming moved to
  // the seconds display cell (handleDisplayTap). Reuses the same X icon/style as
  // "Eliminar serie" below, per the fix design — distinguished by position (this
  // one only appears transiently in 'pending') rather than a different icon.
  let controlIcon = null;
  let controlAriaLabel = 'Iniciar timer';
  if (phase === 'idle') {
    controlIcon = <Play size={14} className="text-slate-500" />;
  } else if (phase === 'countdown') {
    controlIcon = <XCircle size={14} className="text-slate-500" />;
    controlAriaLabel = 'Cancelar timer';
  } else if (phase === 'running') {
    controlIcon = <Square size={13} className="text-red-400" fill="currentColor" />;
    controlAriaLabel = 'Detener timer';
  } else if (phase === 'pending') {
    controlIcon = <XIcon size={15} className="text-slate-500" />;
    controlAriaLabel = 'Descartar tiempo y reintentar';
  } else if (phase === 'editing') {
    // Tocar el control acá sigue sin hacer nada (handleControlTap no tiene rama para
    // 'editing') — este ícono es puramente informativo: "estás corrigiendo un valor ya
    // confirmado", para que no quede en blanco con el label viejo de "Iniciar timer".
    controlIcon = <Pencil size={13} className="text-slate-500" />;
    controlAriaLabel = 'Editando tiempo';
  }

  // ── Companion cell content ───────────────────────────────────────────────────
  let companionContent = <span className="text-slate-700 font-normal">—</span>;
  if (companion === 'difficulty') {
    companionContent = (
      <div className="flex items-center justify-center gap-1.5">
        {DIFFICULTY_LEVELS.map(lvl => (
          <button
            key={lvl.value}
            onClick={() => onUpdateField('companionValue', lvl.value)}
            aria-label={`Dificultad ${lvl.value}`}
            className={`w-3.5 h-3.5 rounded-full border transition ${
              set?.companionValue === lvl.value ? lvl.className : 'bg-transparent border-slate-600'
            }`}
          />
        ))}
      </div>
    );
  } else if (companion === 'hr') {
    if (hrEditing) {
      companionContent = (
        <input
          type="number"
          inputMode="numeric"
          autoFocus
          value={hrDraft}
          onChange={(e) => setHrDraft(e.target.value)}
          onBlur={commitHr}
          onKeyDown={(e) => { if (e.key === 'Enter') commitHr(); }}
          className="w-full h-full bg-transparent text-center text-xs font-bold text-slate-100 outline-none"
        />
      );
    } else {
      companionContent = hasRealValue(set?.companionValue)
        ? <span className={isDone ? 'text-slate-500' : 'text-slate-100'}>{parseInt(set.companionValue, 10)} bpm</span>
        : <span className="text-slate-700 font-normal">—</span>;
    }
  }

  return (
    <div
      className={`relative grid items-center gap-1 px-2 border-b border-slate-900/80 last:border-0 ${isDone ? 'bg-emerald-950/20' : ''}`}
      style={{ gridTemplateColumns: '36px 52px 1fr 1fr 52px 28px 32px', height: '56px' }}
    >
      {/* Check */}
      <button
        onClick={handleCompleteTap}
        className="flex items-center justify-center w-9 h-full rounded-lg active:scale-90 transition-transform"
        aria-label={isDone ? 'Desmarcar' : 'Completar'}
      >
        {isDone
          ? <CheckCircle2 size={24} className="text-emerald-400 stroke-2" />
          : (hasRealValue(set?.seconds))
            ? <Circle size={24} className="text-slate-400 stroke-2 fill-slate-800" />
            : <Circle size={24} className="text-slate-600 stroke-2" />
        }
      </button>

      {/* Tag / set number */}
      <button
        onClick={onCycleType}
        className="flex items-center justify-center h-full rounded-lg active:scale-95 transition-colors"
        aria-label="Cambiar tipo de set"
      >
        {tagLabel
          ? <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider ${tagStyle}`}>{tagLabel}</span>
          : <span className="text-[11px] text-slate-600 font-bold">{setIndex}</span>
        }
      </button>

      {/* Seconds display */}
      <button
        onClick={handleDisplayTap}
        className={`h-10 rounded-lg text-sm font-bold tabular-nums flex items-center justify-center transition-colors ${fieldBtnClass}`}
        aria-label={phase === 'pending' ? 'Confirmar tiempo' : 'Tiempo del set'}
      >
        {secondsContent}
      </button>

      {/* Companion — plain div, not <button>: the 'difficulty' branch renders its own
          nested <button> dots, and a <button> can't legally contain another <button>. */}
      <div
        onClick={companion === 'hr' && !hrEditing ? () => { setHrDraft(set?.companionValue || ''); setHrEditing(true); } : undefined}
        role={companion === 'hr' ? 'button' : undefined}
        tabIndex={companion === 'hr' ? 0 : undefined}
        className={`h-10 rounded-lg text-xs font-bold tabular-nums flex items-center justify-center transition-colors ${fieldBtnClass}`}
        aria-label="Compañero (dificultad / FC)"
      >
        {companionContent}
      </div>

      {/* Timer control */}
      <button
        onClick={handleControlTap}
        className="flex items-center justify-center h-10 rounded-lg bg-slate-900/60 border border-slate-800 hover:bg-slate-900 active:bg-slate-800 transition-colors"
        aria-label={controlAriaLabel}
      >
        {controlIcon}
      </button>

      {/* Note */}
      <button
        onClick={() => setShowNoteModal(true)}
        className={`flex items-center justify-center w-7 h-full rounded-lg active:scale-90 transition-colors ${hasNote ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}
        aria-label="Nota del set"
      >
        <StickyNote size={13} />
      </button>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="flex items-center justify-center w-8 h-full text-slate-600 hover:text-red-400 active:scale-90 transition-colors"
        aria-label="Eliminar serie"
      >
        <XIcon size={15} />
      </button>

      {showNoteModal && (
        <NoteModal
          open={showNoteModal}
          onClose={() => setShowNoteModal(false)}
          initialText={set?.notes || ''}
          title={`Nota — Set ${setIndex}`}
          onSave={(text) => onSaveNote?.(text)}
        />
      )}

      {(showSecondsPad || phase === 'editing') && (
        <SecondsNumPad
          open={showSecondsPad || phase === 'editing'}
          onClose={handleCloseSecondsPad}
          initialValue={set?.seconds}
          setIndex={setIndex}
          onSave={(val) => onUpdateField('seconds', val)}
        />
      )}
    </div>
  );
};
