import { db } from './database';
import { createAutoBackup } from '../services/backupService';
import { BLOCK_TEMPLATES } from '../constants/blockTemplates';

export const getAllBlocks   = () => db.blocks.toArray();
export const getBlock      = (id) => db.blocks.get(id);
export const upsertBlock   = (block) => db.blocks.put(block);
export const deleteBlock   = (id) => db.blocks.delete(id);
export const getActiveBlocks = () => db.blocks.where('status').equals('active').toArray();
export const getBlocksByStatus = (status) => db.blocks.where('status').equals(status).toArray();

export const findActiveBlockForTag = async (tag) => {
  const active = await getActiveBlocks();
  return active.find(b => Array.isArray(b.appliesTo) && b.appliesTo.includes(tag)) || null;
};

export const activateBlock = async (id) => {
  const block = await getBlock(id);
  if (!block) return null;
  const updated = { ...block, status: 'active', startedAt: block.startedAt || new Date().toISOString() };
  await upsertBlock(updated);
  return updated;
};

export const pauseBlock = async (id) => {
  const block = await getBlock(id);
  if (!block) return null;
  await upsertBlock({ ...block, status: 'paused' });
  return block;
};

export const resumeBlock = async (id) => {
  const block = await getBlock(id);
  if (!block) return null;
  await upsertBlock({ ...block, status: 'active' });
  return block;
};

export const completeBlock = async (id) => {
  const block = await getBlock(id);
  if (!block) return null;
  const updated = { ...block, status: 'completed', completedAt: new Date().toISOString() };
  await upsertBlock(updated);
  return updated;
};

export const archiveBlock = async (id) => {
  const block = await getBlock(id);
  if (!block) return null;
  await upsertBlock({ ...block, status: 'archived' });
  return block;
};

export const smartDeleteBlock = async (id) => {
  const block = await getBlock(id);
  if (!block) return { action: 'not-found' };
  if (block.sessionsLogged > 0 || block.status === 'completed') {
    await archiveBlock(id);
    return { action: 'archived' };
  }
  await deleteBlock(id);
  return { action: 'deleted' };
};

export const incrementBlockSessions = async (blockId) => {
  const block = await getBlock(blockId);
  if (!block) return null;
  await upsertBlock({ ...block, sessionsLogged: (block.sessionsLogged || 0) + 1 });
};

// Creates or merges a block from a Coach YAML `bloque:` section.
// Triggers a backup BEFORE any write — aborts if backup fails.
// On update: preserves id, sessionsLogged, startedAt, createdAt, status, color.
export const upsertBlockFromCoach = async (blockMeta) => {
  if (!blockMeta?.coachId) throw new Error('blockMeta.coachId es requerido');

  const backupResult = await createAutoBackup('pre-block-import');
  if (!backupResult.success) throw new Error(`Backup pre-import falló: ${backupResult.error}`);

  const warnings = [];
  const allBlocks = await getAllBlocks();
  const existing = allBlocks.find(b => b.coachId === blockMeta.coachId) || null;

  let block;
  let action;

  if (!existing) {
    const defaultColor = BLOCK_TEMPLATES[blockMeta.type]?.defaultColor || '#f59e0b';
    block = {
      id:             `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      coachId:        blockMeta.coachId,
      name:           blockMeta.name || blockMeta.coachId,
      type:           blockMeta.type || 'custom',
      appliesTo:      blockMeta.appliesTo || [],
      color:          defaultColor,
      status:         'active',
      createdAt:      new Date().toISOString(),
      startedAt:      blockMeta.startedAt || new Date().toISOString(),
      completedAt:    null,
      sessionsLogged: 0,
      sessionsTarget: blockMeta.sessionsTarget ?? null,
      params:         blockMeta.params || {},
      fase:           blockMeta.fase,
      currentWeek:    blockMeta.currentWeek,
      fatigueSignals: { rpeOverTargetCount: 0, progressStallSessions: 0, lastChecked: null },
    };
    action = 'created';
  } else {
    // Only update fields the Coach explicitly sent — never touch sessionsLogged,
    // startedAt, createdAt, id, status, color, or fatigueSignals.
    const updates = {};
    if (blockMeta.name           != null) updates.name           = blockMeta.name;
    if (blockMeta.type           != null) updates.type           = blockMeta.type;
    if (blockMeta.fase           != null) updates.fase           = blockMeta.fase;
    if (blockMeta.currentWeek    != null) updates.currentWeek    = blockMeta.currentWeek;
    if (blockMeta.appliesTo      != null) updates.appliesTo      = blockMeta.appliesTo;
    if (blockMeta.sessionsTarget != null) updates.sessionsTarget = blockMeta.sessionsTarget;
    if (blockMeta.params         != null) updates.params         = blockMeta.params;
    block = { ...existing, ...updates };
    action = 'updated';
  }

  await upsertBlock(block);

  // Close a previous block if Coach requested it
  let closed = null;
  if (blockMeta.closesCoachId) {
    const toClose = allBlocks.find(b => b.coachId === blockMeta.closesCoachId);
    if (toClose) {
      if (toClose.status !== 'completed') {
        closed = await completeBlock(toClose.id);
      } else {
        closed = toClose;
        warnings.push(`Bloque "${toClose.name}" ya estaba completado`);
      }
    } else {
      warnings.push(`Bloque "${blockMeta.closesCoachId}" no encontrado — puede haberse creado manualmente sin coachId`);
    }
  }

  return { action, block, closed, warnings };
};

export const cloneBlock = async (sourceId) => {
  const source = await getBlock(sourceId);
  if (!source) return null;

  const baseName = (source.name || 'Bloque').replace(/\s*\(repetido(\s*\d+)?\)\s*$/i, '');
  const allBlocks = await getAllBlocks();
  const esc = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${esc}\\s*\\(repetido(\\s*\\d+)?\\)\\s*$`, 'i');

  let maxNum = 0;
  for (const b of allBlocks) {
    if (b.name === `${baseName} (repetido)`) maxNum = Math.max(maxNum, 1);
    const m = (b.name || '').match(regex);
    if (m && m[1]) {
      const n = parseInt(m[1].trim(), 10);
      if (!isNaN(n)) maxNum = Math.max(maxNum, n);
    }
  }

  const newName = maxNum === 0
    ? `${baseName} (repetido)`
    : `${baseName} (repetido ${maxNum + 1})`;

  const cloned = {
    ...source,
    id:             `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name:           newName,
    status:         'draft',
    createdAt:      new Date().toISOString(),
    startedAt:      null,
    completedAt:    null,
    sessionsLogged: 0,
    fatigueSignals: { rpeOverTargetCount: 0, progressStallSessions: 0, lastChecked: null },
  };

  await upsertBlock(cloned);
  return cloned;
};
