import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDb } from '../src/db/index.js';
import { getOpenAiKey, getOpenAiKeyStatus, saveOpenAiKey } from '../src/services/settingsService.js';
import { ValidationError } from '../src/errors.js';

let db;
const originalEnvKey = process.env.OPENAI_API_KEY;

beforeEach(() => {
  db = createDb(':memory:');
  delete process.env.OPENAI_API_KEY;
});

afterEach(() => {
  if (originalEnvKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalEnvKey;
  }
});

describe('getOpenAiKeyStatus', () => {
  it('reports no key configured initially', () => {
    expect(getOpenAiKeyStatus(db)).toEqual({ hasKey: false, maskedKey: null });
  });
});

describe('saveOpenAiKey', () => {
  it('saves a valid-looking key and masks it', () => {
    const result = saveOpenAiKey(db, 'sk-abcdefghijklmnop');
    expect(result).toEqual({ hasKey: true, maskedKey: '••••mnop' });
    expect(getOpenAiKey(db)).toBe('sk-abcdefghijklmnop');
  });

  it('rejects a key that does not look like an OpenAI key', () => {
    expect(() => saveOpenAiKey(db, 'not-a-key')).toThrow(ValidationError);
  });

  it('replaces a previously saved key', () => {
    saveOpenAiKey(db, 'sk-firstkey1234567');
    saveOpenAiKey(db, 'sk-secondkey123456');
    expect(getOpenAiKey(db)).toBe('sk-secondkey123456');
  });
});

describe('OPENAI_API_KEY environment variable', () => {
  it('takes priority over a saved DB key', () => {
    saveOpenAiKey(db, 'sk-dbkey1234567890');
    process.env.OPENAI_API_KEY = 'sk-envkey123456789';
    expect(getOpenAiKey(db)).toBe('sk-envkey123456789');
  });

  it('is reported as configured even when no DB key was ever saved', () => {
    process.env.OPENAI_API_KEY = 'sk-envkey123456789';
    expect(getOpenAiKeyStatus(db)).toEqual({ hasKey: true, maskedKey: '••••6789 (from .env)' });
  });

  it('is ignored when blank', () => {
    saveOpenAiKey(db, 'sk-dbkey1234567890');
    process.env.OPENAI_API_KEY = '   ';
    expect(getOpenAiKey(db)).toBe('sk-dbkey1234567890');
  });
});
