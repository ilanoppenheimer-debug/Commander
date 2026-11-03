import React, { useState } from 'react';
import { Wand2, Download, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { previewTaxonomyMigration, applyTaxonomyMigration, summarizePlan } from '../db/migrations/migrateTaxonomyV1';
import { downloadBackupAsFile } from '../services/backupService';

const eqS = (e) => (e === null || e === undefined ? 'sin definir' : e);

const FAIL_MESSAGES = {
  'backup-not-downloaded': 'Primero descargá el backup.',
  'active-session': 'Hay una sesión activa. Terminala o descartala antes de aplicar.',
  'verification-failed': 'La verificación de integridad falló: no se tocó nada.',
  'backup-failed': 'El backup automático falló: no se tocó nada.',
  'write-failed': 'Falló la escritura. Restaurá el backup descargado.',
  'post-check-failed': 'La verificación posterior falló. Restaurá el backup descargado.',
};

/**
 * Datos → one-off cleanup of the exercise taxonomy (phase 2). Never runs by itself: review the
 * changes, download a backup (the rollback), then apply. Everything it does is planned by the
 * pure planTaxonomyMigration, verified before and after writing.
 */
export default function TaxonomyMigrationPanel({ showNotify }) {
  const [state, setState] = useState({ loading: false, plan: null, appliedBefore: null });
  const [downloaded, setDownloaded] = useState(null); // filename of the backup downloaded in this view
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const review = async () => {
    setResult(null);
    setState(s => ({ ...s, loading: true }));
    try {
      const { plan, appliedBefore } = await previewTaxonomyMigration();
      setState({ loading: false, plan, appliedBefore });
    } catch (e) {
      setState({ loading: false, plan: null, appliedBefore: null });
      showNotify?.('No se pudo revisar: ' + String(e), 'error');
    }
  };

  const download = async () => {
    try {
      const filename = await downloadBackupAsFile();
      setDownloaded(filename || 'backup');
      showNotify?.('Backup descargado: guardalo, es tu rollback', 'success');
    } catch (e) {
      showNotify?.('No se pudo descargar el backup', 'error');
    }
  };

  const apply = async () => {
    if (!window.confirm('Se van a renombrar ejercicios, corregir implementos y borrar 5 sesiones duplicadas verificadas. El backup descargado es tu rollback. ¿Aplicar?')) return;
    setBusy(true);
    const r = await applyTaxonomyMigration({ backupDownloaded: !!downloaded });
    setBusy(false);
    setResult(r);
    if (r.ok) { showNotify?.(r.ran ? 'Limpieza aplicada' : 'No había nada para aplicar', 'success'); await review(); }
    else showNotify?.(FAIL_MESSAGES[r.reason] || 'No se pudo aplicar', 'error');
  };

  const { plan } = state;
  const s = plan ? summarizePlan(plan) : null;

  return (
    <section>
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Wand2 size={14} /> Limpieza de taxonomía (fase 2)
      </h3>
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Unifica nombres en su variante y corrige el implemento de cada aparición. Solo cambian <b>nombre</b> e <b>implemento</b>:
          pesos, reps y segundos quedan intactos. Nunca corre sola.
        </p>
        <button onClick={review} disabled={state.loading || busy} className="w-full py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition border border-slate-600">
          {state.loading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Revisar cambios
        </button>

        {plan && plan.noop && (
          <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-700/40 rounded-lg px-3 py-2">
            <CheckCircle2 size={14} /> No hay nada para aplicar{state.appliedBefore ? ` (aplicada el ${new Date(state.appliedBefore).toLocaleDateString()})` : ''}.
          </div>
        )}

        {plan && !plan.noop && (
          <>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {[
                ['Sesiones duplicadas a borrar', s.sessionsRemoved], ['Sesiones tocadas', s.sessionsTouched],
                ['Apariciones renombradas', s.renamed], ['Implementos corregidos', s.equipmentChanged],
                ['Rutinas: ejercicios renombrados', s.routinesRenamed], ['Claves de metadata', s.metadataKeys],
                ['Ejercicios custom a crear', s.customAdded], ['Ejercicios custom a quitar', s.customRemoved],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-900/60 border border-slate-700 rounded-lg px-2 py-1.5 flex justify-between gap-2"><span className="text-slate-400">{k}</span><b className="text-white tabular-nums">{v}</b></div>
              ))}
            </div>
            <div className="text-[10px] text-slate-500">
              Totales (sesiones / sets / peso / reps / seg): {plan.report.totalsBefore.sessions} / {plan.report.totalsBefore.sets} / {plan.report.totalsBefore.weight} / {plan.report.totalsBefore.reps} / {plan.report.totalsBefore.seconds}
              {' → '}{plan.report.totalsAfter.sessions} / {plan.report.totalsAfter.sets} / {plan.report.totalsAfter.weight} / {plan.report.totalsAfter.reps} / {plan.report.totalsAfter.seconds}
            </div>
            {!plan.verification.ok && (
              <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/30 border border-red-600/40 rounded-lg px-3 py-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" /> La verificación falló: {plan.verification.problems.slice(0, 3).join('; ')}
              </div>
            )}
            {plan.report.unmatched.size > 0 && (
              <div className="text-[11px] text-amber-300 bg-amber-950/30 border border-amber-600/40 rounded-lg px-3 py-2">
                Sin regla (quedan como están): {[...plan.report.unmatched.keys()].join(', ')}
              </div>
            )}
            <details className="text-[11px] text-slate-300">
              <summary className="cursor-pointer text-slate-400">Sesiones duplicadas que se borran ({plan.history.removed.length})</summary>
              <ul className="mt-1 space-y-0.5">{plan.history.removed.map(r => <li key={r.historyId}>{r.name} · {r.completedAt?.slice(0, 16).replace('T', ' ')} · {r.historyId}</li>)}</ul>
            </details>
            <details className="text-[11px] text-slate-300">
              <summary className="cursor-pointer text-slate-400">Implementos que cambian ({s.equipmentChanged})</summary>
              <ul className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
                {plan.history.changes.filter(c => c.eqChanged).map((c, i) => <li key={i}>{c.date} · {c.to} · {eqS(c.eqFrom)} → <b>{eqS(c.eqTo)}</b></li>)}
              </ul>
            </details>

            <button onClick={download} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition border border-slate-600">
              <Download size={14} /> 1 · Descargar backup (tu rollback){downloaded ? ' ✓' : ''}
            </button>
            <button onClick={apply} disabled={!downloaded || busy || !plan.verification.ok} className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-black font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} 2 · Aplicar limpieza
            </button>
            <p className="text-[10px] text-slate-500">Rollback: "Restaurar desde archivo" con el backup descargado. La app además guarda un backup automático antes de escribir.</p>
          </>
        )}

        {result && !result.ok && (
          <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/30 border border-red-600/40 rounded-lg px-3 py-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {FAIL_MESSAGES[result.reason] || 'No se pudo aplicar.'}{result.hint ? ' ' + result.hint : ''}
          </div>
        )}
        {result?.ok && result.ran && (
          <div className="text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-700/40 rounded-lg px-3 py-2">
            Aplicada: {result.summary.renamed} renombres, {result.summary.equipmentChanged} implementos corregidos, {result.summary.sessionsRemoved} sesiones duplicadas borradas.
          </div>
        )}
      </div>
    </section>
  );
}
