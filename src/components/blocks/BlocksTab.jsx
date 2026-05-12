import { useState, useEffect, useMemo } from 'react';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { getAllBlocks, cloneBlock } from '../../db/blocks';
import { BlockCard } from './BlockCard';
import { BlockCreateModal } from './BlockCreateModal';
import { BlockEditModal } from './BlockEditModal';

export const BlocksTab = () => {
  const [blocks,            setBlocks]            = useState([]);
  const [refresh,           setRefresh]           = useState(0);
  const [showCreate,        setShowCreate]        = useState(false);
  const [editingBlock,      setEditingBlock]      = useState(null);
  const [completedOpen,     setCompletedOpen]     = useState(false);
  const [archivedOpen,      setArchivedOpen]      = useState(false);

  useEffect(() => {
    getAllBlocks().then(setBlocks).catch(console.error);
  }, [refresh]);

  const grouped = useMemo(() => {
    const result = { active: [], paused: [], completed: [], archived: [] };
    for (const block of blocks) {
      if (block.status === 'archived') {
        result.archived.push(block);
      } else if (block.status === 'completed' && (block.sessionsLogged || 0) === 0) {
        result.archived.push(block);
      } else if (block.status === 'completed') {
        result.completed.push(block);
      } else if (block.status === 'paused') {
        result.paused.push(block);
      } else if (block.status === 'active') {
        result.active.push(block);
      }
    }
    return result;
  }, [blocks]);

  const bump = () => setRefresh(r => r + 1);

  const handleClone = async (block) => {
    const cloned = await cloneBlock(block.id);
    if (cloned) {
      bump();
      setEditingBlock(cloned);
    }
  };

  const cardProps = (b) => ({
    block:   b,
    onTap:   () => setEditingBlock(b),
    onMenu:  () => setEditingBlock(b),
    onClone: handleClone,
  });

  const renderGroup = (label, list, muted = false) => list.length > 0 && (
    <section className={muted ? 'opacity-60' : ''}>
      <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">{label}</h3>
      <div className="space-y-2">
        {list.map(b => <BlockCard key={b.id} {...cardProps(b)} />)}
      </div>
    </section>
  );

  const renderCollapsibleGroup = (label, list, isOpen, setOpen, muted = false) => list.length > 0 && (
    <section className={muted ? 'opacity-60' : ''}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 hover:text-slate-400 transition-colors"
      >
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {label} ({list.length})
      </button>
      {isOpen && (
        <div className="space-y-2">
          {list.map(b => <BlockCard key={b.id} {...cardProps(b)} />)}
        </div>
      )}
    </section>
  );

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Active */}
      <section>
        <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Bloques activos</h3>
        {grouped.active.length === 0 ? (
          <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4 text-center">
            <p className="text-sm text-slate-500 mb-1">No tenés bloques activos</p>
            <p className="text-[10px] text-slate-600">Los bloques controlan parámetros de entrenamiento por tipo de ejercicio</p>
          </div>
        ) : (
          <div className="space-y-2">
            {grouped.active.map(b => <BlockCard key={b.id} {...cardProps(b)} />)}
          </div>
        )}
        <button
          onClick={() => setShowCreate(true)}
          className="w-full mt-2 py-2.5 border border-dashed border-slate-700 rounded-xl text-sm text-slate-400 hover:text-accent-400 hover:border-accent-500/50 flex items-center justify-center gap-1 transition-colors"
        >
          <Plus size={14} /> Nuevo bloque
        </button>
      </section>

      {renderGroup('Pausados', grouped.paused)}
      {renderCollapsibleGroup('Completados', grouped.completed, completedOpen, setCompletedOpen)}
      {renderCollapsibleGroup('Archivados', grouped.archived, archivedOpen, setArchivedOpen, true)}

      <BlockCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={bump}
      />

      {editingBlock && (
        <BlockEditModal
          block={editingBlock}
          onClose={() => setEditingBlock(null)}
          onUpdated={() => { bump(); setEditingBlock(null); }}
        />
      )}
    </div>
  );
};
