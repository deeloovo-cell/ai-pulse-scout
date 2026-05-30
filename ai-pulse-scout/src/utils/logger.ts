const isQuiet = process.env.LOG_LEVEL === 'quiet';

export const logger = {
  info: (msg: string, ...args: unknown[]) => {
    if (!isQuiet) console.log(`[INFO]  ${msg}`, ...args);
  },
  warn: (msg: string, ...args: unknown[]) => {
    console.warn(`[WARN]  ${msg}`, ...args);
  },
  error: (msg: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${msg}`, ...args);
  },
  debug: (msg: string, ...args: unknown[]) => {
    if (process.env.LOG_LEVEL === 'debug') console.log(`[DEBUG] ${msg}`, ...args);
  },
};
