import OpenAI from 'openai';
import { OPENAI_SEARCH_MODEL } from '../config.js';

export const MAX_RESULTS = 20;
export const MAX_AGE_DAYS = 45;

export function buildSearchPrompt(title) {
  return `You are searching for current, real job postings in Israel for the title "${title}" (including reasonably equivalent/synonymous titles).

Use web search to find real, currently open job postings. Return at most ${MAX_RESULTS} postings, each published within the last ${MAX_AGE_DAYS} days.

Respond with ONLY a JSON array (no markdown, no commentary, no code fences) where each element has exactly these fields:
{
  "postingTitle": string,
  "description": string,
  "company": string,
  "url": string,
  "location": string,
  "publishedDate": string (ISO 8601 date, e.g. "2026-08-01")
}

If you find no matching postings, respond with exactly: []`;
}

export function parseSearchResponse(rawText) {
  const cleaned = String(rawText ?? '')
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('OpenAI returned a response that was not valid JSON');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('OpenAI response was not a JSON array');
  }
  return parsed;
}

export async function searchJobPostings(apiKey, title) {
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: OPENAI_SEARCH_MODEL,
    tools: [{ type: 'web_search' }],
    input: buildSearchPrompt(title)
  });
  return parseSearchResponse(response.output_text);
}
