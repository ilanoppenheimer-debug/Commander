import { normalizeExerciseName as norm } from './exerciseName';
import { mergeExerciseMeta } from '../constants/exerciseMetadata';
import { DEFAULT_EXERCISE_DB } from '../constants/gymConstants';
import {
  TAXONOMY_RULES, TAXONOMY_META_ALIASES, TAXONOMY_META_EQUIPMENT, TAXONOMY_JUNK, TAXONOMY_DUPLICATE_SESSIONS,
} from './taxonomyMapping';

// PURE: no IO, never mutates its input. The Node dry-run and the in-app tool run exactly this
// function, so what was reviewed on the backup is what runs on the device.
//
//   input  { history, routines, customExercises: string[], metadata: {} }
//   returns the next state of each piece, a per-appearance change list, and a verification
//   that proves history only changed in exercise name/equipment (plus the removed duplicates).

const day = (s) => String(s?.completedAt || '').slice(0, 10);
const eqOrNull = (e) => (e === undefined || e === '' ? null : e);
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const setsTxt = (ex) => (ex.sets || [])
  .filter(s => parseFloat(s.weight) > 0 || parseInt(s.reps, 10) > 0 || parseInt(s.seconds, 10) > 0).slice(0, 5)
  .map(s => (parseInt(s.seconds, 10) > 0 && !(parseInt(s.reps, 10) > 0) ? `${s.seconds}s` : `${parseFloat(s.weight) > 0 ? s.weight : 'PC'}×${s.reps}`)).join(', ');

const totals = (rows) => rows.reduce((a, s) => {
  a.sessions++;
  for (const e of s.exercises || []) {
    a.exercises++;
    for (const st of e.sets || []) { a.sets++; a.weight += parseFloat(st.weight) || 0; a.reps += parseInt(st.reps, 10) || 0; a.seconds += parseInt(st.seconds, 10) || 0; }
  }
  return a;
}, { sessions: 0, exercises: 0, sets: 0, weight: 0, reps: 0, seconds: 0 });

// What makes two saved sessions "the same training": exercises, implements and every set.
const sessionSignature = (s) => JSON.stringify((s.exercises || []).map(e => [e.name, e.equipment ?? null, e.sets]));
const stripNameEq = (e) => { const { name, equipment, ...rest } = e; return rest; };

export const planTaxonomyMigration = (input, now = new Date().toISOString()) => {
  const history = Array.isArray(input?.history) ? input.history : [];
  const routines = Array.isArray(input?.routines) ? input.routines : [];
  const custom = Array.isArray(input?.customExercises) ? input.customExercises : [];
  const meta = input?.metadata && typeof input.metadata === 'object' ? input.metadata : {};

  // ---- rule index (fresh counters per run: the rules are shared constants)
  const rules = TAXONOMY_RULES.map(r => ({ ...r, changed: 0, fix: (r.fix || []).map(f => ({ ...f, hit: 0 })) }));
  const bySource = new Map();
  for (const r of rules) for (const n of r.from) bySource.set(norm(n), r);
  // Variant names the mapping PRODUCES are already final: a name that is only ever a target (e.g.
  // "Press Inclinado") is known — left alone and never reported as "sin regla" on a second pass.
  const finalVariants = new Set(rules.map(r => norm(r.to)));

  // ---- 1. duplicated sessions: removed only when verifiably identical to the kept one
  const removedIds = new Set(); const dupReport = [];
  for (const g of TAXONOMY_DUPLICATE_SESSIONS) {
    const keep = history.find(s => s.historyId === g.keep);
    if (!keep) { dupReport.push({ keep: g.keep, skipped: 'la sesión a conservar no está' }); continue; }
    const keepSig = sessionSignature(keep);
    for (const id of g.remove) {
      const row = history.find(s => s.historyId === id);
      if (!row) continue; // already gone (idempotent)
      if (sessionSignature(row) !== keepSig) { dupReport.push({ id, skipped: 'su contenido ya no es idéntico al de la conservada' }); continue; }
      removedIds.add(id);
      dupReport.push({ id, name: row.name, completedAt: row.completedAt, keep: g.keep });
    }
  }
  const removedRows = history.filter(s => removedIds.has(s.historyId));
  const keptRows = history.filter(s => !removedIds.has(s.historyId));

  // ---- 2. history: rename + implement per appearance
  const changes = []; const unmatched = new Map(); const perVariant = new Map(); let appearances = 0;
  const nextHistory = keptRows.map(s => {
    let touched = false;
    const exercises = (s.exercises || []).map(ex => {
      appearances++;
      const rule = bySource.get(norm(ex.name));
      if (!rule && finalVariants.has(norm(ex.name))) {
        const pv = perVariant.get(ex.name) || { src: new Map(), after: new Map(), n: 0, first: day(s), last: day(s) };
        pv.n++; pv.src.set(ex.name, (pv.src.get(ex.name) || 0) + 1);
        const ek = ex.equipment ?? '(sin definir)'; pv.after.set(ek, (pv.after.get(ek) || 0) + 1);
        if (day(s) < pv.first) pv.first = day(s); if (day(s) > pv.last) pv.last = day(s);
        perVariant.set(ex.name, pv);
        return ex;
      }
      if (!rule) {
        const u = unmatched.get(ex.name) || { n: 0, first: day(s), last: day(s), eq: {} };
        u.n++; if (day(s) < u.first) u.first = day(s); if (day(s) > u.last) u.last = day(s);
        const k = ex.equipment ?? '(sin definir)'; u.eq[k] = (u.eq[k] || 0) + 1; unmatched.set(ex.name, u);
        return ex;
      }
      const before = eqOrNull(ex.equipment); let eq = before; let why = '';
      if (rule.all !== undefined) { if (eq !== rule.all) why = 'variante de un solo implemento'; eq = rule.all; }
      for (const f of rule.fix) {
        if ((!f.date || day(s) === f.date) && (f.from === undefined || ex.equipment === f.from)) { f.hit++; if (eq !== f.to) why = 'corrección por aparición'; eq = f.to; }
      }
      const renamed = ex.name !== rule.to, eqChanged = before !== eq;
      const pv = perVariant.get(rule.to) || { src: new Map(), after: new Map(), n: 0, first: day(s), last: day(s) };
      pv.n++; pv.src.set(ex.name, (pv.src.get(ex.name) || 0) + 1);
      const ek = eq ?? '(sin definir)'; pv.after.set(ek, (pv.after.get(ek) || 0) + 1);
      if (day(s) < pv.first) pv.first = day(s); if (day(s) > pv.last) pv.last = day(s);
      perVariant.set(rule.to, pv);
      if (!renamed && !eqChanged) return ex;
      if (rule.all !== undefined && eqChanged) rule.changed++;
      touched = true;
      changes.push({ historyId: s.historyId, date: day(s), from: ex.name, to: rule.to, eqFrom: before, eqTo: eq, renamed, eqChanged, why, sets: setsTxt(ex) });
      return { ...ex, name: rule.to, equipment: eq };
    });
    return touched ? { ...s, exercises } : s;
  });

  // ---- 3. routines: same renames (names only)
  const routineUnmatched = new Map(); let routinesRenamed = 0;
  const nextRoutines = routines.map(r => {
    let touched = false;
    const exercises = (r.exercises || []).map(e => {
      const rule = bySource.get(norm(e.name));
      if (!rule) { if (!finalVariants.has(norm(e.name))) routineUnmatched.set(e.name, (routineUnmatched.get(e.name) || 0) + 1); return e; }
      if (rule.to === e.name) return e;
      touched = true; routinesRenamed++; return { ...e, name: rule.to };
    });
    return touched ? { ...r, exercises } : r;
  });

  // ---- 4. custom exercises
  const catalogue = new Set(DEFAULT_EXERCISE_DB.map(norm));
  const customNorm = new Set(custom.map(norm));
  const usedAfter = new Set();
  nextHistory.forEach(s => (s.exercises || []).forEach(e => usedAfter.add(norm(e.name))));
  nextRoutines.forEach(r => (r.exercises || []).forEach(e => usedAfter.add(norm(e.name))));
  const finalNames = new Map(); // norm -> display
  nextHistory.forEach(s => (s.exercises || []).forEach(e => finalNames.set(norm(e.name), e.name)));
  nextRoutines.forEach(r => (r.exercises || []).forEach(e => finalNames.set(norm(e.name), e.name)));
  // Only names a rename produced get a custom row (so they keep showing in the selector); a name
  // that was never renamed is left exactly as it is.
  const renamedTargets = new Set(rules.filter(r => r.from.some(n => norm(n) !== norm(r.to))).map(r => norm(r.to)));
  const customAdd = [...finalNames].filter(([n]) => renamedTargets.has(n) && !catalogue.has(n) && !customNorm.has(n)).map(([, d]) => d).sort();
  const junkNorm = new Set(TAXONOMY_JUNK.map(norm));
  const renamedAway = (n) => { const r = bySource.get(norm(n)); return !!r && norm(r.to) !== norm(n); };
  const customRemove = custom.filter(n => !usedAfter.has(norm(n)) && (renamedAway(n) || junkNorm.has(norm(n))));
  const catalogueOrphans = [...new Set(rules.flatMap(r => r.from))].filter(n => catalogue.has(norm(n)) && renamedAway(n) && !usedAfter.has(norm(n)));

  // ---- 5. metadata
  const nextMeta = { ...meta }; const metaMoves = [], metaEquipment = [], metaContradictions = [], metaJunk = [];
  const targets = new Map();
  for (const r of rules) { const t = targets.get(r.to) || new Set(); r.from.forEach(n => t.add(norm(n))); t.add(norm(r.to)); targets.set(r.to, t); }
  for (const [alias, to] of Object.entries(TAXONOMY_META_ALIASES)) { if (!targets.has(to)) targets.set(to, new Set([norm(to)])); targets.get(to).add(norm(alias)); }
  const liveEq = new Map(); // variant -> Map(eq -> count) from the corrected history
  for (const [v, pv] of perVariant) liveEq.set(v, pv.after);
  for (const [to, names] of targets) {
    const keys = Object.keys(meta).filter(k => names.has(norm(k)));
    if (!keys.length) continue;
    const base = keys.includes(to) ? to : keys[0];
    let merged = { ...meta[base] };
    for (const k of keys.filter(k => k !== base)) merged = mergeExerciseMeta(meta[k], merged);
    const decided = TAXONOMY_META_EQUIPMENT[to];
    if (decided !== undefined && merged.equipment !== decided) {
      metaEquipment.push({ to, from: merged.equipment ?? null, by: merged.equipmentAssignedBy || '(sin procedencia)', toEq: decided, reason: 'decisión del atleta' });
      merged = { ...merged, equipment: decided, equipmentAssignedBy: 'taxonomy-migration', equipmentAssignedAt: now };
    } else if (decided === undefined && merged.equipment) {
      const dist = liveEq.get(to);
      const present = dist ? [...dist.keys()].filter(k => k !== '(sin definir)') : [];
      if (present.length && !present.includes(merged.equipment)) {
        const dominant = [...dist].filter(([k]) => k !== '(sin definir)').sort((a, b) => b[1] - a[1])[0][0];
        if (merged.equipmentAssignedBy === 'user-manual' || merged.equipmentOverride === true) metaContradictions.push({ to, from: merged.equipment, by: merged.equipmentAssignedBy || '(override)', eqs: present, suggest: dominant });
        else { metaEquipment.push({ to, from: merged.equipment, by: merged.equipmentAssignedBy || '(sin procedencia)', toEq: dominant, reason: 'no está entre los implementos del historial' }); merged = { ...merged, equipment: dominant, equipmentAssignedBy: 'taxonomy-migration', equipmentAssignedAt: now }; }
      }
    }
    const group = Object.fromEntries(keys.map(k => [k, meta[k]]));
    const out = { [to]: merged };
    if (!sameJson(group, out)) {
      for (const k of keys) if (k !== to) delete nextMeta[k];
      nextMeta[to] = merged;
      metaMoves.push({ to, keys, merged: keys.length > 1 });
    }
  }
  for (const k of Object.keys(nextMeta)) if (junkNorm.has(norm(k)) && !usedAfter.has(norm(k))) { delete nextMeta[k]; metaJunk.push(k); }
  const metaUnmatched = Object.keys(nextMeta).filter(k => ![...targets.values()].some(t => t.has(norm(k))) && !junkNorm.has(norm(k)));

  // ---- 6. verification: history changed ONLY in name/equipment (+ the removed duplicates)
  const problems = [];
  if (nextHistory.length !== history.length - removedIds.size) problems.push('el número de sesiones no cuadra');
  const keptIdx = keptRows.map((s) => s);
  for (let i = 0; i < keptIdx.length; i++) {
    const a = keptIdx[i], b = nextHistory[i];
    const { exercises: ea, ...ra } = a, { exercises: eb, ...rb } = b;
    if (!sameJson(ra, rb)) problems.push(`sesión ${a.historyId}: cambió algo fuera de exercises`);
    if ((ea || []).length !== (eb || []).length) { problems.push(`sesión ${a.historyId}: distinto número de ejercicios`); continue; }
    for (let j = 0; j < (ea || []).length; j++) if (!sameJson(stripNameEq(ea[j]), stripNameEq(eb[j]))) problems.push(`sesión ${a.historyId} ej ${j}: cambió algo además de name/equipment`);
  }
  const before = totals(history), afterExpected = (() => { const t = totals(history); const r = totals(removedRows); return Object.fromEntries(Object.keys(t).map(k => [k, t[k] - r[k]])); })(), after = totals(nextHistory);
  if (Object.keys(after).some(k => Math.abs(afterExpected[k] - after[k]) > 1e-6)) problems.push('los totales de sesiones, sets, pesos, reps o segundos no cuadran');
  if (!removedRows.every(s => TAXONOMY_DUPLICATE_SESSIONS.some(g => g.remove.includes(s.historyId)))) problems.push('se quitó una sesión que no está en la lista de duplicadas');

  // ---- expectations vs the reviewed backup (informational only: live data may have moved on)
  const expectMismatches = [];
  for (const r of rules) {
    if (r.all !== undefined && r.expect !== undefined && r.changed !== r.expect) expectMismatches.push(`${r.from.join(' + ')} → todas ${r.all}: esperadas ${r.expect}, hubo ${r.changed}`);
    for (const f of r.fix) if (f.hit !== f.expect) expectMismatches.push(`${r.from.join(' + ')}: ${f.date || ''} ${f.from}→${f.to}: esperadas ${f.expect}, hubo ${f.hit}`);
  }

  const changedHistory = nextHistory.map((s, i) => (s !== keptRows[i] ? s : null)).filter(Boolean);
  const noop = !changedHistory.length && !removedIds.size && !routinesRenamed && !customAdd.length && !customRemove.length && !metaMoves.length && !metaJunk.length;
  return {
    noop,
    history: { next: nextHistory, changed: changedHistory, removed: removedRows, changes, appearances },
    routines: { next: nextRoutines, renamed: routinesRenamed, unmatched: [...routineUnmatched] },
    customExercises: { add: customAdd, remove: customRemove, catalogueOrphans },
    metadata: { next: nextMeta, moves: metaMoves, equipment: metaEquipment, contradictions: metaContradictions, junk: metaJunk, unmatched: metaUnmatched },
    report: { perVariant, unmatched, duplicates: dupReport, expectMismatches, totalsBefore: before, totalsAfter: after },
    verification: { ok: problems.length === 0, problems },
  };
};
