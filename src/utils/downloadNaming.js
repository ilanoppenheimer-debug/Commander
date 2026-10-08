import { localDateStr } from './localDate';

export const sanitizeForFilename = (str) => {
  if (!str) return 'Untitled';
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50) || 'Untitled';
};

// Local date, not UTC: a backup/export made at 22:00 UTC-3 must carry that day's date.
export const formatDate = (date = new Date()) => localDateStr(date);

export const formatDateTime = (date = new Date()) =>
  `${localDateStr(date)}-${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;

export const buildFilename = (type, identifier = '', ext = 'json') => {
  const parts = ['IronCmdr', type];
  if (identifier) parts.push(sanitizeForFilename(identifier));
  parts.push(formatDate());
  return `${parts.join('_')}.${ext}`;
};
