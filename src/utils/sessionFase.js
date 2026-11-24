// Same transform the active-blocks summary card uses to display a block's fase —
// snake_case field, spaced for display. Only resolved when a session's blockIds names
// exactly one block: 0 means nothing to show, 2+ means picking one would be an
// arbitrary guess, neither is "the" fase.
export const getSessionFase = (s, blocksById) => {
  if (!Array.isArray(s?.blockIds) || s.blockIds.length !== 1) return undefined;
  const block = blocksById.get(s.blockIds[0]);
  return block?.fase ? block.fase.replace(/_/g, ' ') : undefined;
};
