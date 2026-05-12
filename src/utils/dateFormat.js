export const formatRelativeTime = (isoDate) => {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days}d`;
  if (days < 30) return `hace ${Math.floor(days / 7)}sem`;
  return `hace ${Math.floor(days / 30)}m`;
};
