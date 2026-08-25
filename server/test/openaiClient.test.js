import { describe, it, expect } from 'vitest';
import { buildSearchPrompt, parseSearchResponse } from '../src/services/openaiClient.js';

describe('buildSearchPrompt', () => {
  it('includes the title, Israel, the result cap, and the freshness window', () => {
    const prompt = buildSearchPrompt('Product Manager');
    expect(prompt).toContain('Product Manager');
    expect(prompt).toContain('Israel');
    expect(prompt).toContain('20');
    expect(prompt).toContain('45');
  });
});

describe('parseSearchResponse', () => {
  it('parses a plain JSON array', () => {
    const result = parseSearchResponse('[{"postingTitle":"PM","url":"https://example.com/1"}]');
    expect(result).toEqual([{ postingTitle: 'PM', url: 'https://example.com/1' }]);
  });

  it('parses a JSON array wrapped in a markdown code fence', () => {
    const result = parseSearchResponse('```json\n[{"postingTitle":"PM","url":"https://example.com/1"}]\n```');
    expect(result).toEqual([{ postingTitle: 'PM', url: 'https://example.com/1' }]);
  });

  it('parses an explicit empty array', () => {
    expect(parseSearchResponse('[]')).toEqual([]);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseSearchResponse('not json')).toThrow('not valid JSON');
  });

  it('throws when the JSON is valid but not an array', () => {
    expect(() => parseSearchResponse('{"postingTitle":"PM"}')).toThrow('not a JSON array');
  });
});
