import React from 'react';
import { Shield, Download, RefreshCw, Copy } from 'lucide-react';
import { downloadBackupAsFile } from '../services/backupService';
import { getDatabaseCounts } from '../db/repository';

export default function ErrorFallback({ error, resetErrorBoundary }) {
  const handleExport = async () => {
    try {
      await downloadBackupAsFile();
    } catch (e) {
      alert('No se pudo exportar: ' + String(e));
    }
  };

  const handleReport = async () => {
    try {
      const counts = await getDatabaseCounts();
      const report = [
        `Iron Commander — Error Report`,
        `Fecha: ${new Date().toISOString()}`,
        `Error: ${error?.message}`,
        `Stack: ${error?.stack}`,
        `UserAgent: ${navigator.userAgent}`,
        `Datos: ${JSON.stringify(counts)}`,
      ].join('\n');
      await navigator.clipboard.writeText(report);
      alert('Reporte copiado al portapapeles.');
    } catch (e) {
      alert('No se pudo copiar: ' + String(e));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-xl">
            <Shield className="text-accent-400" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Algo salió mal</h2>
            <p className="text-xs text-slate-500">Tus datos están seguros en IndexedDB</p>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-400 max-h-32 overflow-y-auto">
          {error?.message || 'Error desconocido'}
        </div>

        <div className="space-y-2">
          <button
            onClick={handleExport}
            className="w-full flex items-center justify-center gap-2 py-3 bg-accent-600 hover:bg-accent-500 text-black font-bold rounded-xl transition active:scale-95"
          >
            <Download size={16} /> Exportar mis datos AHORA
          </button>
          <button
            onClick={resetErrorBoundary}
            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700 transition active:scale-95"
          >
            <RefreshCw size={16} /> Reintentar
          </button>
          <button
            onClick={handleReport}
            className="w-full flex items-center justify-center gap-2 py-3 text-slate-400 hover:text-white transition text-sm"
          >
            <Copy size={14} /> Copiar reporte al portapapeles
          </button>
        </div>
      </div>
    </div>
  );
}
