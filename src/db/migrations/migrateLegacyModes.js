import { db } from '../database';
import { upsertBlock } from '../blocks';
import { createBlockFromTemplate } from '../../constants/blockTemplates';

/**
 * V2 migration: converts legacy modes/fases into real active/completed blocks.
 * Idempotent via 'legacyModesMigratedV2' flag.
 * V1 flag ('legacyModesMigrated') used to produce archived blocks — we skip re-migrating
 * those entries by checking both flags.
 */

const TYPE_MAP = {
  BASE:            'accumulation',
  ACUMULACION:     'accumulation',
  ACUMULACIÓN:     'accumulation',
  FUERZA:          'intensification',
  INTENSIFICATION: 'intensification',
  INTENSIFICACION: 'intensification',
  INTENSIFICACIÓN: 'intensification',
  PEAKING:         'peaking',
  PICO:            'peaking',
  DESCARGA:        'deload',
  DELOAD:          'deload',
  DESCANSO:        'deload',
  MANTENIMIENTO:   'maintenance',
  MAINTENANCE:     'maintenance',
  HIPERTROFIA:     'hypertrophy',
  HYPERTROPHY:     'hypertrophy',
  STANDARD:        null,
  LIBRE:           null,
};

const inferType = (name) => {
  if (!name) return 'custom';
  const upper = name.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ]/g, '');
  for (const [key, type] of Object.entries(TYPE_MAP)) {
    if (upper.includes(key)) return type;
  }
  return 'custom';
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

export const migrateLegacyModes = async () => {
  try {
    const flagV2 = await db.settings.get('legacyModesMigratedV2').catch(() => null);
    if (flagV2?.value === true) return { ran: false, reason: 'already-migrated-v2' };

    // Backup preventivo (non-blocking)
    try {
      const { createAutoBackup } = await import('../../services/backupService');
      await createAutoBackup('pre-blocks-migration-v2');
    } catch { /* continuar */ }

    // Find legacy modes — try Dexie first, then localStorage
    let legacyModes = null;
    let currentLegacyMode = null;

    try {
      const setting = await db.settings.get('modes').catch(() => null);
      if (setting?.value && Array.isArray(setting.value)) legacyModes = setting.value;
      const cm = await db.settings.get('currentMode').catch(() => null);
      currentLegacyMode = cm?.value || null;
      const am = await db.settings.get('activeModeId').catch(() => null);
      if (!currentLegacyMode && am?.value) currentLegacyMode = am.value;
    } catch { /* ignore */ }

    if (!legacyModes) {
      try {
        const raw = localStorage.getItem('IronSuiteDataV14');
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data?.modes)) legacyModes = data.modes;
          if (!currentLegacyMode) currentLegacyMode = data?.currentMode || data?.selectedMode || null;
        }
      } catch { /* ignore */ }
    }

    let migratedCount = 0;
    const migratedBlocks = [];

    if (Array.isArray(legacyModes) && legacyModes.length > 0) {
      for (const mode of legacyModes) {
        if (!mode || typeof mode !== 'object') continue;

        const type = inferType(mode.label || mode.name);
        if (type === null) continue; // skip "modo libre" / "standard"

        const isCurrentlyActive =
          mode.id === currentLegacyMode ||
          mode.id === 'standard' && currentLegacyMode === 'standard'; // standard already skipped above

        const weeklyMod = (typeof mode.weightMod === 'number'
          && mode.weightMod > 0.5
          && mode.weightMod < 1.5)
          ? mode.weightMod : 1.0;

        const block = createBlockFromTemplate(type, {
          name:      mode.label || mode.name || `Bloque ${type}`,
          appliesTo: ['main_lift', 'secondary', 'accessory', 'isolation'],
          params: {
            setsRange:          [parseInt(mode.sets, 10) || 3, parseInt(mode.sets, 10) || 5],
            repsRange:          parseRepRange(mode.repRange),
            rpeRange:           parseRpeRange(mode.rpe),
            intensityRange:     [70, 80],
            weightProgression:  'rpe_based',
            weeklyMod,
            cnsLoad:            'medium',
            suggestedFrequency: 2,
            notes:              `Migrado de fase legacy. Desc: ${mode.desc || ''}`,
          },
        });

        if (isCurrentlyActive) {
          block.status    = 'active';
          block.startedAt = new Date().toISOString();
        } else {
          block.status      = 'completed';
          block.completedAt = new Date().toISOString();
        }

        await upsertBlock(block);
        migratedBlocks.push(block);
        migratedCount++;
      }
    }

    await db.settings.put({ key: 'legacyModesMigratedV2', value: true });
    await db.settings.put({ key: 'legacyModesUiKilled',   value: true });

    const activeCount = migratedBlocks.filter(b => b.status === 'active').length;
    console.log('[Migration v2]', { migratedCount, activeCount });

    return {
      ran:            true,
      migratedCount,
      activeBlockIds: migratedBlocks.filter(b => b.status === 'active').map(b => b.id),
    };
  } catch (e) {
    console.error('[migrateLegacyModes v2] error:', e);
    return { ran: false, error: String(e) };
  }
};
