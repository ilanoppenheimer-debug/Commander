import { db } from '../database';
import { loadExerciseMeta, saveExerciseMeta } from '../../constants/exerciseMetadata';

// English IDs matching MUSCLE_GROUP_OPTIONS in exerciseMetadata.js
const PATTERNS = [
  // LEGS — includes deadlifts (hip-hinge / posterior chain)
  { pattern: /^peso\s+muerto(?!\s+rumano)/i,           group: 'legs' },
  { pattern: /^deadlift(?!\s+rumanian)/i,              group: 'legs' },
  { pattern: /^buenos\s+d[ií]as/i,                    group: 'legs' },
  { pattern: /^good\s+morning/i,                      group: 'legs' },
  { pattern: /^(peso\s+muerto\s+)?rumano|^rdl\b/i,    group: 'legs' },

  // BACK — jalones, rows
  { pattern: /^jal[oó]n/i,                            group: 'back' },
  { pattern: /^pulldown/i,                             group: 'back' },
  { pattern: /^remo\b/i,                              group: 'back' },
  { pattern: /^row\b/i,                               group: 'back' },

  // SHOULDERS — facepull, laterals, rear delts
  { pattern: /^facepull|^face\s*pull/i,               group: 'shoulders' },
  { pattern: /^elevaci[oó]n\s+lateral/i,              group: 'shoulders' },
  { pattern: /^lateral\s+raise/i,                     group: 'shoulders' },
  { pattern: /^p[aá]jaros/i,                          group: 'shoulders' },
  { pattern: /^rear\s+delt/i,                         group: 'shoulders' },

  // ARMS — curls, triceps extensions
  { pattern: /^curl\b/i,                              group: 'arms' },
  { pattern: /^hammer\s+curl|martillo/i,              group: 'arms' },
  { pattern: /^extensi[oó]n\s+(de\s+)?tr[ií]ceps/i,  group: 'arms' },
  { pattern: /^tr[ií]ceps\s+(extension|pushdown)/i,   group: 'arms' },
  { pattern: /^press\s+franc[eé]s/i,                  group: 'arms' },
  { pattern: /^skull\s*crusher|^rompecr[aá]neos/i,   group: 'arms' },
];

const inferGroup = (name) => {
  if (!name) return null;
  for (const { pattern, group } of PATTERNS) {
    if (pattern.test(name)) return group;
  }
  return null;
};

/**
 * Safety-net migration: updates muscleGroup in localStorage exercise metadata.
 * Skips entries already marked with muscleGroupOverride:true.
 * Idempotent via db.settings flag.
 */
export const migrateMuscleGroups = async () => {
  const flag = await db.settings.get('muscleGroupsMigratedV1');
  if (flag?.value === true) {
    return { ran: false, reason: 'already-migrated' };
  }

  try {
    const { createAutoBackup } = await import('../../services/backupService');
    await createAutoBackup('pre-muscle-groups-migration');
  } catch (e) {
    console.warn('[migration muscle groups] backup failed:', e);
  }

  const allMeta = loadExerciseMeta();
  let updated = 0;
  const changes = [];

  for (const [name, meta] of Object.entries(allMeta)) {
    if (meta.muscleGroupOverride === true) continue;

    const inferred = inferGroup(name);
    if (!inferred) continue;

    if (meta.muscleGroup !== inferred) {
      saveExerciseMeta(name, {
        muscleGroup: inferred,
        muscleGroupAssignedAt: new Date().toISOString(),
        muscleGroupAssignedBy: 'auto-migration-safety-net',
      });
      changes.push({ name, old: meta.muscleGroup, new: inferred });
      updated++;
    }
  }

  await db.settings.put({ key: 'muscleGroupsMigratedV1', value: true });
  console.log('[migration muscle groups]', { updated, changes });

  return { ran: true, updated, changes };
};
