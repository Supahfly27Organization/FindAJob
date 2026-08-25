import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../src/db/index.js';
import { getOpenAiKey, getOpenAiKeyStatus, saveOpenAiKey } from '../src/services/settingsService.js';
import { ValidationError } from '../src/errors.js';

let db;

beforeEach(() => {
  db = createDb(':memory:');
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
