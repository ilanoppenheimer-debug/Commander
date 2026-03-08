import React from "react";

export default function InputGroup({
  label,
  value,
  onChange,
  type = "text",
  suffix,
  step = "1",
  placeholder = ""
}) {
  return (
    <div className="flex flex-col gap-2 relative group">
      <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold ml-1">
        {label}
      </label>

      <div className="relative">
        <input
          type={type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          step={step}
          placeholder={placeholder}
          className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-3 text-white font-mono text-lg focus:border-blue-500 focus:outline-none transition-colors placeholder-slate-600"
        />

        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}