import { getSetting, setSetting, deleteSetting } from '../db/repository';
import { logger } from './logger';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'Iron Commander Backups';

// ── Google Identity Services loader ─────────────────────────────────────────
const loadGIS = () =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar Google Identity Services'));
    document.head.appendChild(s);
  });

// ── Token management ─────────────────────────────────────────────────────────
let _tokenClient = null;

const getToken = async () => {
  const stored = await getSetting('googleToken');
  if (!stored) return null;
  if (Date.now() < stored.expiresAt - 60_000) return stored.access_token;
  return null; // expired
};

const saveToken = (token) =>
  setSetting('googleToken', {
    access_token: token.access_token,
    expiresAt: Date.now() + (token.expires_in || 3600) * 1000,
    email: token.email || null,
  });

// ── Auth ─────────────────────────────────────────────────────────────────────
export const initGoogleAuth = async () => {
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID no configurado');
  await loadGIS();
};

export const signInToGoogle = () =>
  new Promise(async (resolve, reject) => {
    try {
      await initGoogleAuth();
      if (!_tokenClient) {
        _tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE,
          callback: async (response) => {
            if (response.error) { reject(new Error(response.error)); return; }
            await saveToken(response);
            logger.info('Google Drive sign-in successful');
            resolve(response.access_token);
          },
        });
      }
      _tokenClient.requestAccessToken({ prompt: '' });
    } catch (e) {
      reject(e);
    }
  });

export const signOutFromGoogle = async () => {
  const stored = await getSetting('googleToken');
  if (stored?.access_token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(stored.access_token);
  }
  await Promise.all([
    deleteSetting('googleToken'),
    deleteSetting('googleFolderId'),
  ]);
  logger.info('Google Drive signed out');
};

export const getSignedInEmail = async () => {
  const stored = await getSetting('googleToken');
  return stored?.email || null;
};

export const isSignedIn = async () => {
  const token = await getToken();
  return token !== null;
};

// ── Drive API helpers ────────────────────────────────────────────────────────
const driveRequest = async (url, options = {}) => {
  const token = await getToken();
  if (!token) throw new Error('No autenticado con Google Drive');
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Drive API error ${res.status}`);
  }
  return res;
};

export const ensureBackupFolder = async () => {
  const cached = await getSetting('googleFolderId');
  if (cached) return cached;

  const res = await driveRequest(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id)`
  );
  const data = await res.json();

  if (data.files?.length > 0) {
    await setSetting('googleFolderId', data.files[0].id);
    return data.files[0].id;
  }

  const createRes = await driveRequest(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );
  const folder = await createRes.json();
  await setSetting('googleFolderId', folder.id);
  return folder.id;
};

export const uploadBackup = async (jsonString, filename) => {
  const folderId = await ensureBackupFolder();
  const metadata = { name: filename, parents: [folderId] };
  const boundary = '-------314159265358979323846';
  const body = [
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}`,
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${jsonString}`,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await driveRequest(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime',
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` },
      body,
    }
  );
  const file = await res.json();
  await setSetting('lastBackupDate', new Date().toISOString());
  await setSetting('lastBackupDriveId', file.id);
  logger.info('Backup uploaded to Drive', { fileId: file.id, filename });
  return file;
};

export const listBackups = async () => {
  const folderId = await ensureBackupFolder();
  const res = await driveRequest(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and trashed=false`)}&orderBy=createdTime desc&fields=files(id,name,size,createdTime)&pageSize=50`
  );
  const data = await res.json();
  return data.files || [];
};

export const downloadBackupFromDrive = async (fileId) => {
  const res = await driveRequest(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  );
  const text = await res.text();
  return JSON.parse(text);
};

export const deleteBackupFromDrive = async (fileId) => {
  await driveRequest(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    { method: 'DELETE' }
  );
};

// ── Rotation policy ───────────────────────────────────────────────────────────
export const applyRotationPolicy = async (files) => {
  const now = new Date();

  const keepIds = new Set();
  const byDate = [...files].sort((a, b) =>
    new Date(b.createdTime) - new Date(a.createdTime)
  );

  // Keep last 7 daily backups
  const seenDays = new Set();
  for (const f of byDate) {
    const day = f.createdTime.slice(0, 10);
    if (seenDays.size < 7 && !seenDays.has(day)) {
      seenDays.add(day);
      keepIds.add(f.id);
    }
  }

  // Keep last 4 weekly backups (last Monday of each week)
  const seenWeeks = new Set();
  for (const f of byDate) {
    const d = new Date(f.createdTime);
    const week = `${d.getFullYear()}-W${String(Math.ceil(d.getDate() / 7)).padStart(2, '0')}`;
    if (seenWeeks.size < 4 && !seenWeeks.has(week)) {
      seenWeeks.add(week);
      keepIds.add(f.id);
    }
  }

  // Keep last 6 monthly backups
  const seenMonths = new Set();
  for (const f of byDate) {
    const month = f.createdTime.slice(0, 7);
    if (seenMonths.size < 6 && !seenMonths.has(month)) {
      seenMonths.add(month);
      keepIds.add(f.id);
    }
  }

  const toDelete = files.filter(f => !keepIds.has(f.id));
  for (const f of toDelete) {
    try { await deleteBackupFromDrive(f.id); } catch { /* best-effort */ }
  }

  return { kept: keepIds.size, deleted: toDelete.length };
};

// ── High-level backup entrypoint ─────────────────────────────────────────────
export const performDriveBackup = async (backupObj) => {
  const json = JSON.stringify(backupObj);
  const date = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
  const filename = `iron-cmdr-backup-${date}.json`;

  const file = await uploadBackup(json, filename);

  try {
    const files = await listBackups();
    await applyRotationPolicy(files);
  } catch {
    // rotation failure is non-critical
  }

  return file;
};
