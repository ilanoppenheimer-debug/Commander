export const sanitizeForFilename = (str) => {
  if (!str) return 'Untitled';
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50) || 'Untitled';
};

export const formatDate = (date = new Date()) =>
  date.toISOString().slice(0, 10);

export const formatDateTime = (date = new Date()) =>
  date.toISOString().slice(0, 16).replace(/[:T]/g, '-');

export const buildFilename = (type, identifier = '', ext = 'json') => {
  const parts = ['IronCmdr', type];
  if (identifier) parts.push(sanitizeForFilename(identifier));
  parts.push(formatDate());
  return `${parts.join('_')}.${ext}`;
};
