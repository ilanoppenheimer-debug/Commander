export const formatSessionAsText = (session, barUnit = 'kg') => {
  if (!session) return '';
  const safeExercises = Array.isArray(session.exercises) ? session.exercises : [];
  const date = session.completedAt ? new Date(session.completedAt).toLocaleDateString('es-CL') : '';
  const lines = [`🏋️ ${session.name || 'Entrenamiento'} · ${date}`, ''];
  let totalSets = 0, totalVolume = 0;

  safeExercises.forEach(ex => {
    if (!ex) return;
    const safeSets = Array.isArray(ex.sets) ? ex.sets : [];
    if (safeSets.length === 0) return;
    lines.push(`${ex.name}`);
    safeSets.forEach((s, i) => {
      const w = parseFloat(s?.weight) || 0;
      const r = parseFloat(s?.reps) || 0;
      const rpe = parseFloat(s?.rpe) || 0;
      const type = s?.type && s.type !== 'normal' ? `[${s.type.toUpperCase()}] ` : '';
      if (w > 0 || r > 0) {
        lines.push(`  ${i + 1}) ${type}${w}${barUnit} × ${r}${rpe ? ` @ RPE ${rpe}` : ''}`);
        totalSets++;
        totalVolume += w * r;
      }
    });
    lines.push('');
  });

  lines.push(`📊 Total: ${totalSets} series · ${Math.round(totalVolume)} ${barUnit}-rep`);
  return lines.join('\n');
};

export const downloadSessionAsJSON = (session) => {
  const filename = `IronCmdr_${(session.name || 'session').replace(/\s+/g, '_')}_${new Date(session.completedAt).toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const shareSessionNative = async (session, barUnit) => {
  if (!navigator.share) return false;
  const text = formatSessionAsText(session, barUnit);
  try {
    await navigator.share({ title: `${session.name || 'Sesión'} - Iron Cmdr`, text });
    return true;
  } catch { return false; }
};
