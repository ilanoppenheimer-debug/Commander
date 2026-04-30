export const TimeframeSelector = ({ options, value, onChange }) => (
  <div className="flex gap-1 bg-slate-900 p-1 rounded-lg">
    {options.map(opt => (
      <button
        key={opt.id}
        onClick={() => onChange(opt.id)}
        className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
          value === opt.id
            ? 'bg-accent-600 text-black'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);
