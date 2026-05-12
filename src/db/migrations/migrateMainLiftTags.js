import { loadExerciseMeta, saveExerciseMeta } from '../../constants/exerciseMetadata';

const MIGRATION_FLAG_KEY = 'ironcmdr_mainlift_tags_v1';

const PATTERNS = [
  { pattern: /^sentadilla(\s+(con\s+)?(barra|trasera|back))?$/i, tag: 'main_lift' },
  { pattern: /^back\s+squat$/i,                                   tag: 'main_lift' },
  { pattern: /^peso\s+muerto(\s+(convencional|conv))?$/i,         tag: 'main_lift' },
  { pattern: /^deadlift$/i,                                        tag: 'main_lift' },
  { pattern: /^(press\s+)?banca(\s+plana)?$/i,                    tag: 'main_lift' },
  { pattern: /^bench\s+press$/i,                                   tag: 'main_lift' },
  { pattern: /^press\s+(militar|de\s+pie|overhead|ohp)$/i,        tag: 'main_lift' },
  { pattern: /^overhead\s+press$/i,                                tag: 'main_lift' },
  { pattern: /^military\s+press$/i,                                tag: 'main_lift' },
  { pattern: /sentadilla\s+(frontal|front|pausa|paused|pin|tempo|p[eé]ndulo)/i, tag: 'secondary' },
  { pattern: /front\s+squat/i,                                     tag: 'secondary' },
  { pattern: /banca\s+(pausa|paused|inclinada|declined|agarre\s+cerrado)/i,     tag: 'secondary' },
  { pattern: /peso\s+muerto\s+(sumo|d[eé]ficit|pausa|rumano|rdl)/i,             tag: 'secondary' },
  { pattern: /press\s+banca\s+agarre\s+cerrado/i,                  tag: 'secondary' },
  { pattern: /close\s*grip\s*bench/i,                              tag: 'secondary' },
];

const inferTag = (name) => {
  if (!name) return null;
  for (const { pattern, tag } of PATTERNS) {
    if (pattern.test(name)) return tag;
  }
  return null;
};

/**
 * Safety net migration — only assigns tags to exercises with no tag yet.
 * Never overwrites user-assigned tags.
 */
export const migrateMainLiftTags = () => {
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'done') {
    return { ran: false, reason: 'already-migrated' };
  }

  const all = loadExerciseMeta();
  let updated = 0;

  for (const [name, meta] of Object.entries(all)) {
    if (meta.defaultTag) continue;

    const inferredTag = inferTag(name);
    if (!inferredTag) continue;

    saveExerciseMeta(name, {
      defaultTag: inferredTag,
      tagAssignedAt: new Date().toISOString(),
      tagAssignedBy: 'auto-migration-safety-net',
    });
    updated++;
  }

  localStorage.setItem(MIGRATION_FLAG_KEY, 'done');
  console.log('[migration mainlift tags - safety net]', { updated });
  return { ran: true, updated };
};
