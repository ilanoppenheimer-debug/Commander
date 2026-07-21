import { useState, useEffect } from 'react';
import { getActiveBlocks, getSessionCountsByBlock } from '../db/blocks';

export const useActiveBlocks = (refreshKey = 0) => {
  const [blocks, setBlocks]   = useState([]);
  const [sessionCounts, setSessionCounts] = useState(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getActiveBlocks(), getSessionCountsByBlock()])
      .then(([result, counts]) => {
        if (cancelled) return;
        setBlocks(Array.isArray(result) ? result : []);
        setSessionCounts(counts);
        setLoading(false);
      })
      .catch(e => { console.error('[useActiveBlocks]', e); if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  return { blocks, sessionCounts, loading };
};
