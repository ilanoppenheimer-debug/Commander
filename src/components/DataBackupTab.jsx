import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud, CloudOff, Download, Upload, Trash2, RefreshCw, Database,
  AlertTriangle, Check, Loader2, Eye, EyeOff, X, HardDrive
} from 'lucide-react';
import {
  signInToGoogle, signOutFromGoogle, isSignedIn, getSignedInEmail,
  listBackups, downloadBackupFromDrive, performDriveBackup
} from '../services/googleDriveService';
import {
  createBackup, downloadBackupAsFile, parseBackupFile,
  validateBackup, restoreFromBackup
} from '../services/backupService';
import { getDatabaseCounts, clearAllData } from '../db/repository';
import { getSetting } from '../db/repository';
import { getRecentLogs, exportLogsAsText } from '../services/logger';

export default function DataBackupTab({ showNotify }) {
  const [driveEmail, setDriveEmail]       = useState(null);
  const [driveLoading, setDriveLoading]   = useState(false);
  const [driveBackups, setDriveBackups]   = useState([]);
  const [showAllBackups, setShowAllBackups] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState(null);
  const [counts, setCounts]               = useState(null);
  const [restoring, setRestoring]         = useState(false);
  const [restoreSource, setRestoreSource] = useState(null);
  const [resetConfirm, setResetConfirm]   = useState('');
  const [showLogs, setShowLogs]           = useState(false);
  const [logs, setLogs]                   = useState([]);
  const [logFilter, setLogFilter]         = useState('all');
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    const [email, counts, lbd] = await Promise.all([
      getSignedInEmail().catch(() => null),
      getDatabaseCounts().catch(() => null),
      getSetting('lastBackupDate').catch(() => null),
    ]);
    setDriveEmail(email);
    setCounts(counts);
    setLastBackupDate(lbd);
    if (email) loadDriveBackups();
  };

  const loadDriveBackups = async () => {
    try {
      const files = await listBackups();
      setDriveBackups(files);
    } catch { setDriveBackups([]); }
  };

  const handleSignIn = async () => {
    setDriveLoading(true);
    try {
      await signInToGoogle();
      await loadStatus();
      showNotify?.('Conectado a Google Drive', 'success');
    } catch (e) {
      showNotify?.('Error: ' + String(e), 'error');
    } finally {
      setDriveLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutFromGoogle();
    setDriveEmail(null);
    setDriveBackups([]);
    showNotify?.('Desconectado de Google Drive', 'info');
  };

  const handleDriveBackupNow = async () => {
    setDriveLoading(true);
    try {
      const backup = await createBackup();
      await performDriveBackup(backup);
      await loadStatus();
      showNotify?.('Backup subido a Drive', 'success');
    } catch (e) {
      showNotify?.('Error: ' + String(e), 'error');
    } finally {
      setDriveLoading(false);
    }
  };

  const handleRestoreFromDrive = async (fileId) => {
    setRestoreSource(fileId);
    setRestoring(true);
    try {
      const backup = await downloadBackupFromDrive(fileId);
      const before = await createBackup();
      await restoreFromBackup(backup);
      showNotify?.('Datos restaurados. Recarga la página para ver los cambios.', 'success');
    } catch (e) {
      showNotify?.('Error restaurando: ' + String(e), 'error');
    } finally {
      setRestoring(false);
      setRestoreSource(null);
    }
  };

  const handleDownloadLocal = async () => {
    try {
      const filename = await downloadBackupAsFile();
      showNotify?.(`Descargado: ${filename}`, 'success');
    } catch (e) {
      showNotify?.('Error: ' + String(e), 'error');
    }
  };

  const handleRestoreFromFile = async (file) => {
    if (!file) return;
    setRestoring(true);
    try {
      const backup = await parseBackupFile(file);
      const v = await validateBackup(backup);
      if (!v.valid) throw new Error(v.error);
      await createBackup(); // pre-restore safety backup
      await restoreFromBackup(backup);
      showNotify?.('Datos restaurados. Recarga la página.', 'success');
    } catch (e) {
      showNotify?.('Error: ' + String(e), 'error');
    } finally {
      setRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReset = async () => {
    if (resetConfirm !== 'BORRAR') return;
    try {
      await downloadBackupAsFile(); // safety backup first
      await clearAllData();
      showNotify?.('App reseteada. Recarga la página.', 'success');
    } catch (e) {
      showNotify?.('Error: ' + String(e), 'error');
    }
    setResetConfirm('');
  };

  const handleShowLogs = async () => {
    const recent = await getRecentLogs(100);
    setLogs(recent);
    setShowLogs(true);
  };

  const handleExportLogs = async () => {
    const text = await exportLogsAsText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iron-cmdr-logs-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const visibleBackups = showAllBackups ? driveBackups : driveBackups.slice(0, 5);
  const filteredLogs = logFilter === 'all' ? logs : logs.filter(l => l.level === logFilter);

  return (
    <div className="space-y-6">

      {/* Google Drive */}
      <section>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Cloud size={14} /> Google Drive
        </h3>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-4">
          {driveEmail ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-xs text-emerald-400 font-bold">{driveEmail}</span>
                </div>
                <button onClick={handleSignOut} className="text-[10px] text-slate-500 hover:text-red-400 transition">Desconectar</button>
              </div>

              {lastBackupDate && (
                <p className="text-[10px] text-slate-500">
                  Último backup: {new Date(lastBackupDate).toLocaleString()}
                </p>
              )}

              <button
                onClick={handleDriveBackupNow}
                disabled={driveLoading}
                className="w-full py-2 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-black font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition"
              >
                {driveLoading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Crear backup ahora
              </button>

              {driveBackups.length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">Backups en Drive</div>
                  <div className="space-y-1">
                    {visibleBackups.map((f) => (
                      <div key={f.id} className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2 text-[11px]">
                        <div>
                          <div className="text-slate-300 font-mono truncate max-w-[180px]">{f.name}</div>
                          <div className="text-slate-600">{new Date(f.createdTime).toLocaleDateString()}</div>
                        </div>
                        <button
                          onClick={() => handleRestoreFromDrive(f.id)}
                          disabled={restoring && restoreSource === f.id}
                          className="text-accent-400 hover:text-accent-300 font-bold transition flex items-center gap-1"
                        >
                          {restoring && restoreSource === f.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                          Restaurar
                        </button>
                      </div>
                    ))}
                  </div>
                  {driveBackups.length > 5 && (
                    <button onClick={() => setShowAllBackups(v => !v)} className="text-[10px] text-slate-500 hover:text-white mt-2 w-full text-center">
                      {showAllBackups ? 'Ver menos' : `Ver todos (${driveBackups.length})`}
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <button
              onClick={handleSignIn}
              disabled={driveLoading || !import.meta.env.VITE_GOOGLE_CLIENT_ID}
              className="w-full py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition border border-slate-600"
            >
              {driveLoading ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />}
              {import.meta.env.VITE_GOOGLE_CLIENT_ID ? 'Conectar con Google Drive' : 'Configura VITE_GOOGLE_CLIENT_ID primero'}
            </button>
          )}
        </div>
      </section>

      {/* Local backup */}
      <section>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <HardDrive size={14} /> Backup Local
        </h3>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-2">
          <button onClick={handleDownloadLocal} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition border border-slate-600">
            <Download size={14} /> Descargar backup a disco
          </button>
          <label className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition border border-slate-600 cursor-pointer">
            <Upload size={14} /> Restaurar desde archivo
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={(e) => handleRestoreFromFile(e.target.files?.[0])} />
          </label>
        </div>
      </section>

      {/* Counters */}
      {counts && (
        <section>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Database size={14} /> Base de Datos
          </h3>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 grid grid-cols-2 gap-3">
            {[
              { label: 'Sesiones', value: counts.history },
              { label: 'Rutinas', value: counts.routines },
              { label: 'Ejercicios Custom', value: counts.customExercises },
              { label: 'Logs', value: counts.logs },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-900 rounded-lg p-3 text-center">
                <div className="text-2xl font-black text-white">{value}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button onClick={handleShowLogs} className="flex-1 py-2 text-[10px] font-bold text-slate-400 bg-slate-900 rounded-lg border border-slate-700 hover:border-slate-500 flex items-center justify-center gap-1 transition">
              <Eye size={12} /> Ver logs
            </button>
            <button onClick={handleExportLogs} className="flex-1 py-2 text-[10px] font-bold text-slate-400 bg-slate-900 rounded-lg border border-slate-700 hover:border-slate-500 flex items-center justify-center gap-1 transition">
              <Download size={12} /> Exportar logs
            </button>
          </div>
        </section>
      )}

      {/* Danger zone */}
      <section>
        <h3 className="text-xs font-bold text-red-500/80 uppercase tracking-wider mb-3 flex items-center gap-2">
          <AlertTriangle size={14} /> Zona de Peligro
        </h3>
        <div className="bg-red-950/20 rounded-xl border border-red-900/50 p-4 space-y-3">
          <p className="text-[11px] text-red-300/70">
            Antes de resetear se descarga un backup automático. Escribe <span className="font-mono font-bold text-red-400">BORRAR</span> para confirmar.
          </p>
          <input
            type="text"
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
            placeholder="Escribe BORRAR"
            className="w-full bg-slate-950 border border-red-900/50 rounded-lg p-2 text-white text-sm font-mono focus:border-red-500 focus:outline-none"
          />
          <button
            onClick={handleReset}
            disabled={resetConfirm !== 'BORRAR'}
            className="w-full py-2 bg-red-700 hover:bg-red-600 disabled:opacity-30 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition"
          >
            <Trash2 size={14} /> Resetear toda la app
          </button>
        </div>
      </section>

      {/* Logs modal */}
      {showLogs && (
        <div className="fixed inset-0 z-[130] bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowLogs(false)}>
          <div className="bg-slate-900 w-full max-w-2xl max-h-[85vh] rounded-t-2xl sm:rounded-2xl border border-slate-700 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-white">Logs del Sistema</h3>
              <button onClick={() => setShowLogs(false)} className="p-1 text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex gap-1 p-3 border-b border-slate-800 shrink-0">
              {['all', 'error', 'warn', 'info', 'debug'].map(l => (
                <button key={l} onClick={() => setLogFilter(l)} className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${logFilter === l ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}>{l}</button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-1">
              {filteredLogs.length === 0 ? (
                <p className="text-slate-600 text-center py-8">Sin logs</p>
              ) : (
                filteredLogs.map((l, i) => (
                  <div key={i} className={`px-2 py-1 rounded ${l.level === 'error' ? 'bg-red-950/30 text-red-300' : l.level === 'warn' ? 'bg-amber-950/30 text-amber-300' : 'text-slate-400'}`}>
                    <span className="text-slate-600">[{l.timestamp?.slice(11,19)}]</span>{' '}
                    <span className="font-bold uppercase">[{l.level}]</span>{' '}
                    {l.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
