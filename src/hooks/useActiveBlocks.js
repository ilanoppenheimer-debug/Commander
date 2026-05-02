import { useState, useEffect } from 'react';
import { getActiveBlocks } from '../db/blocks';

export const useActiveBlocks = (refreshKey = 0) => {
  const [blocks, setBlocks]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getActiveBlocks()
      .then(result => { if (!cancelled) { setBlocks(Array.isArray(result) ? result : []); setLoading(false); } })
      .catch(e => { console.error('[useActiveBlocks]', e); if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  return { blocks, loading };
};
