import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

export const ExerciseSearchInput = ({ value, onChange, history }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const containerRef = useRef(null);

  const exerciseList = useMemo(() => {
    const counts = new Map();
    if (!Array.isArray(history)) return [];
    history.forEach(s => {
      const exes = Array.isArray(s?.exercises) ? s.exercises : [];
      exes.forEach(e => {
        if (e?.name) counts.set(e.name, (counts.get(e.name) || 0) + 1);
      });
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [history]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exerciseList.slice(0, 20);
    return exerciseList.filter(e => e.name.toLowerCase().includes(q)).slice(0, 20);
  }, [query, exerciseList]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  // Sync external value changes (e.g. preselection cleared)
  useEffect(() => {
    if (value !== query) setQuery(value || '');
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (name) => {
    setQuery(name);
    onChange(name);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    onChange('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (e.target.value === '') onChange('');
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar ejercicio..."
          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-9 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent-500 focus:outline-none"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-slate-900 border border-slate-700 rounded-lg max-h-56 overflow-y-auto z-20 shadow-xl">
          {filtered.map(ex => (
            <button
              key={ex.name}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(ex.name); }}
              className="w-full px-3 py-2.5 hover:bg-slate-800 text-left flex items-center justify-between border-b border-slate-800/50 last:border-0"
            >
              <span className="text-sm text-slate-200 truncate pr-2">{ex.name}</span>
              <span className="text-[10px] text-slate-500 shrink-0">{ex.count}×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
