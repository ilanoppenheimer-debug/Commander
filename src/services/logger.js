import { db } from '../db/database';

const MAX_LOG_ENTRIES = 500;

const write = async (level, message, context = {}) => {
  try {
    const count = await db.logs.count();
    if (count >= MAX_LOG_ENTRIES) {
      const oldest = await db.logs.orderBy('_id').first();
      if (oldest) await db.logs.delete(oldest._id);
    }
    await db.logs.add({
      timestamp: new Date().toISOString(),
      level,
      message: String(message),
      context: typeof context === 'object' ? context : { raw: context },
      stackTrace: context?.stack || null,
    });
  } catch {
    // logger must never throw
  }
};

export const logger = {
  debug: (msg, ctx) => write('debug', msg, ctx),
  info:  (msg, ctx) => write('info',  msg, ctx),
  warn:  (msg, ctx) => write('warn',  msg, ctx),
  error: (msg, ctx) => write('error', msg, ctx),
};

// Auto-capture unhandled errors
if (typeof window !== 'undefined') {
  window.onerror = (message, source, lineno, colno, error) => {
    logger.error('Unhandled error', { message, source, lineno, colno, stack: error?.stack });
  };
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', {
      reason: String(event.reason),
      stack: event.reason?.stack,
    });
  });
}

export const getRecentLogs = (limit = 100) =>
  db.logs.orderBy('_id').reverse().limit(limit).toArray();

export const exportLogsAsText = async () => {
  const logs = await db.logs.orderBy('_id').toArray();
  return logs
    .map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}${l.context ? ' ' + JSON.stringify(l.context) : ''}`)
    .join('\n');
};
