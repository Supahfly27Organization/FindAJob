import { ValidationError } from '../errors.js';

const OPENAI_KEY_SETTING = 'openaiApiKey';
const KEY_FORMAT = /^sk-[A-Za-z0-9_-]{10,}$/;

function getEnvKey() {
  const key = process.env.OPENAI_API_KEY;
  return typeof key === 'string' && key.trim() ? key.trim() : null;
}

export function getOpenAiKeyStatus(db) {
  const envKey = getEnvKey();
  if (envKey) {
    return { hasKey: true, maskedKey: `••••${envKey.slice(-4)} (from .env)` };
  }
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(OPENAI_KEY_SETTING);
  if (!row || !row.value) {
    return { hasKey: false, maskedKey: null };
  }
  return { hasKey: true, maskedKey: `••••${row.value.slice(-4)}` };
}

export function saveOpenAiKey(db, rawKey) {
  const key = typeof rawKey === 'string' ? rawKey.trim() : '';
  if (!KEY_FORMAT.test(key)) {
    throw new ValidationError('That does not look like a valid OpenAI API key');
  }
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(OPENAI_KEY_SETTING, key);
  return getOpenAiKeyStatus(db);
}

export function getOpenAiKey(db) {
  const envKey = getEnvKey();
  if (envKey) {
    return envKey;
  }
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(OPENAI_KEY_SETTING);
  return row?.value ?? null;
}
