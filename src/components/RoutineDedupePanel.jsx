import React, { useEffect, useState } from 'react';
import { Copy, Download, Loader2, AlertTriangle, CheckCircle2, Undo2 } from 'lucide-react';
import { previewRoutineDedupe, applyRoutineDedupe, rollbackRoutineDedupe } from '../db/migrations/migrateDedupeRoutines';
import { downloadBackupAsFile } from '../services/backupService';

const FAIL_MESSAGES = {
  'backup-failed': 'El backup automático falló: no se tocó nada.',
  'write-failed': 'Falló la escritura: no se aplicó nada.',
  'post-check-failed': 'La verificación posterior falló. Restaurá el backup descargado.',
  'rollback-failed': 'No se pudo deshacer. Restaurá el backup descargado.',
  'not-applied': 'No hay nada para deshacer.',
};

const day = (x) => (x ? String(x).slice(0, 10) : '—');
const kind = (r) => (r.isImported ? 'import' : 'plantilla');
const Row = ({ r, note }) => (
  <li>
    <b>{r.name || 'Sin nombre'}</b> · {kind(r)} · {day(r.importedAt || r.createdAt)} · última vez {day(r.lastPerformed)} · _id {r._id}{note ? ` · ${note}` : ''}
  </li>
);

/**
 * Datos → deduplicación de plantillas (una sola vez). Muestra el dry-run sobre los datos ACTUALES, pide descargar un
 * backup y confirmar, y se oculta cuando ya se aplicó o no hay nada para hacer. Nunca corre sola.
 */
export default function RoutineDedupePanel({ showNotify, onChanged }) {
  const [state, setState] = useState({ loading: true, plan: null, appliedAt: null });
  const [downloaded, setDownloaded] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // resultado de ESTA vista (con "Deshacer")

  const review = async () => {
    try {
      const { plan, appliedAt } = await previewRoutineDedupe();
      setState({ loading: false, plan, appliedAt });
    } catch (e) {
      setState({ loading: false, plan: null, appliedAt: null });
    }
  };
  useEffect(() => { review(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const download = async () => {
    try {
      const filename = await downloadBackupAsFile();
      setDownloaded(filename || 'backup');
      showNotify?.('Backup descargado: guardalo, es tu rollback', 'success');
    } catch {
      showNotify?.('No se pudo descargar el backup', 'error');
    }
  };

  const apply = async () => {
    const s = state.plan.summary;
    if (!window.confirm(`Se van a eliminar ${s.removed} fila(s) repetida(s) y archivar ${s.archivedByName + s.archivedByBlock} plantilla(s). Quedan ${s.after.active} activas. El backup descargado es tu rollback. ¿Aplicar?`)) return;
    setBusy(true);
    const r = await applyRoutineDedupe();
    setBusy(false);
    setResult(r);
    if (r.ok) { showNotify?.(r.ran ? 'Plantillas ordenadas' : 'No había nada para aplicar', 'success'); onChanged?.(); await review(); }
    else showNotify?.(FAIL_MESSAGES[r.reason] || 'No se pudo aplicar', 'error');
  };

  const undo = async () => {
    if (!window.confirm('¿Deshacer la deduplicación? Se reinsertan las filas eliminadas y se desarchivan las plantillas.')) return;
    setBusy(true);
    const r = await rollbackRoutineDedupe();
    setBusy(false);
    if (r.ok) { setResult(null); showNotify?.('Deduplicación deshecha', 'success'); onChanged?.(); await review(); }
    else showNotify?.(FAIL_MESSAGES[r.reason] || 'No se pudo deshacer', 'error');
  };

  const { plan, loading, appliedAt } = state;
  // Resultado recién aplicado: se muestra (con Deshacer) hasta que se recargue la vista.
  if (result?.ok && result.ran) {
    return (
      <section data-testid="dedupe-done">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-2">
          <div className="text-xs text-emerald-300 flex items-start gap-2"><CheckCircle2 size={14} className="shrink-0 mt-0.5" /> Listo: {result.summary.removed} fila(s) repetida(s) eliminada(s), {result.summary.archivedByName + result.summary.archivedByBlock} archivada(s). Quedan {result.summary.after.active} plantillas activas.</div>
          <button onClick={undo} disabled={busy} className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"><Undo2 size={12} /> Deshacer</button>
        </div>
      </section>
    );
  }
  if (loading || !plan || appliedAt || plan.noop) return null;

  const s = plan.summary;
  return (
    <section data-testid="dedupe-panel">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Copy size={14} /> Ordenar plantillas duplicadas
      </h3>
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Hay filas repetidas (mismo id de plantilla) y plantillas con el mismo nombre. Se eliminan solo las filas repetidas, el resto se <b>archiva</b> (se puede desarchivar).
          Calculado sobre tus datos actuales; no corre sola.
        </p>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          {[['Filas repetidas a eliminar', s.removed], ['Archivar: mismo nombre', s.archivedByName],
            ['Archivar: sin uso en el bloque', s.archivedByBlock], ['Plantillas activas después', `${s.before.active} → ${s.after.active}`]].map(([k, v]) => (
            <div key={k} className="bg-slate-900/60 border border-slate-700 rounded-lg px-2 py-1.5 flex justify-between gap-2"><span className="text-slate-400">{k}</span><b className="text-white">{v}</b></div>
          ))}
        </div>
        <details className="text-[11px] text-slate-300">
          <summary className="cursor-pointer text-slate-400">1 · Filas repetidas que se eliminan ({s.removed})</summary>
          <ul className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
            {plan.pass1.groups.flatMap((g) => g.remove.map((r) => <Row key={r._id} r={r} note={`queda _id ${g.keep._id}`} />))}
          </ul>
        </details>
        <details className="text-[11px] text-slate-300">
          <summary className="cursor-pointer text-slate-400">2 · Archivar por nombre repetido ({s.archivedByName})</summary>
          <ul className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
            {plan.pass2.groups.flatMap((g) => g.archive.map((r) => <Row key={r._id} r={r} note={`gana _id ${g.winner._id}`} />))}
          </ul>
        </details>
        <details className="text-[11px] text-slate-300">
          <summary className="cursor-pointer text-slate-400">3 · Archivar: sin uso ni import desde el inicio del bloque ({s.archivedByBlock})</summary>
          <ul className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
            {plan.pass3.archive.map((r) => <Row key={r._id} r={r} />)}
          </ul>
          {plan.pass3.since && <p className="text-[10px] text-slate-500 mt-1">Desde {day(plan.pass3.since)} (inicio del bloque activo).</p>}
        </details>
        <details className="text-[11px] text-slate-300" open>
          <summary className="cursor-pointer text-slate-400">Quedan activas ({s.after.active})</summary>
          <ul className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">{plan.finalActive.map((r) => <Row key={r._id} r={r} />)}</ul>
        </details>

        <button onClick={download} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition border border-slate-600">
          <Download size={14} /> 1 · Descargar backup (tu rollback){downloaded ? ' ✓' : ''}
        </button>
        <button onClick={apply} disabled={!downloaded || busy} className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-black font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />} 2 · Ordenar plantillas
        </button>
        <p className="text-[10px] text-slate-500">La app además guarda un backup automático antes de escribir; si falla, no se toca nada.</p>
        {result && !result.ok && (
          <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/30 border border-red-600/40 rounded-lg px-3 py-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {FAIL_MESSAGES[result.reason] || 'No se pudo aplicar.'}{result.hint ? ' ' + result.hint : ''}
          </div>
        )}
      </div>
    </section>
  );
}
