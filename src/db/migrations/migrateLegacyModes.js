import { db } from '../database';
import { upsertBlock } from '../blocks';
import { createBlockFromTemplate } from '../../constants/blockTemplates';
import { createAutoBackup } from '../../services/backupService';

/**
 * One-time migration: converts legacy modes/fases to archived blocks.
 * Idempotent — uses settings flag 'legacyModesMigrated'.
 */
export const migrateLegacyModes = async () => {
  try {
    const flag = await db.settings.get('legacyModesMigrated');
    if (flag?.value === true) return { ran: false };

    // Backup before migrating
    try { await createAutoBackup('pre-blocks-migration'); } catch { /* non-blocking */ }

    let legacyModes = null;

    // Try settings table first
    const setting = await db.settings.get('modes').catch(() => null);
    if (setting?.value && Array.isArray(setting.value)) {
      legacyModes = setting.value;
    }

    // Fallback: localStorage
    if (!legacyModes) {
      try {
        const raw = localStorage.getItem('IronSuiteDataV14');
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data?.modes)) legacyModes = data.modes;
        }
      } catch { /* ignore */ }
    }

    let migratedCount = 0;
    if (Array.isArray(legacyModes)) {
      for (const mode of legacyModes) {
        if (!mode || typeof mode !== 'object') continue;
        if (mode.id === 'standard') continue; // skip default mode

        const block = createBlockFromTemplate('custom', {
          name:      mode.label || mode.name || 'Bloque migrado',
          appliesTo: ['main_lift', 'accessory'],
          params: {
            setsRange:           [parseInt(mode.sets) || 3, parseInt(mode.sets) || 5],
            repsRange:           mode.repRange ? parseRepRange(mode.repRange) : [5, 8],
            rpeRange:            mode.rpe ? parseRpeRange(mode.rpe) : [7, 8],
            intensityRange:      [70, 80],
            weightProgression:   'rpe_based',
            weeklyMod:           parseFloat(mode.weightMod) || 1.0,
            cnsLoad:             'medium',
            suggestedFrequency:  2,
            notes:               `Migrado del sistema de fases. Descripción original: ${mode.desc || ''}`,
          },
        });
        block.status = 'archived';
        block.completedAt = new Date().toISOString();
        await upsertBlock(block);
        migratedCount++;
      }
    }

    await db.settings.put({ key: 'legacyModesMigrated', value: true });
    console.log(`[migrateLegacyModes] migrated ${migratedCount} modes`);
    return { ran: true, migratedCount };
  } catch (e) {
    console.error('[migrateLegacyModes] error:', e);
    return { ran: false, error: String(e) };
  }
};

const parseRepRange = (str) => {
  if (!str) return [5, 8];
  const parts = String(str).split('-').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  if (parts.length === 2) return [parts[0], parts[1]];
  if (parts.length === 1) return [parts[0], parts[0]];
  return [5, 8];
};

const parseRpeRange = (str) => {
  if (!str) return [7, 8];
  const parts = String(str).split('-').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
  if (parts.length === 2) return [parts[0], parts[1]];
  if (parts.length === 1) return [parts[0], Math.min(10, parts[0] + 1)];
  return [7, 8];
};
