import { db } from './database';

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
