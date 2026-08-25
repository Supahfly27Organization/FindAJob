import OpenAI from 'openai';
import { OPENAI_SEARCH_MODEL, OPENAI_ADAPTATION_MODEL } from '../config.js';

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

export function buildAdaptationPrompt(templateText, posting) {
  return `You are adapting a job seeker's resume to better match a specific job posting, without fabricating anything.

RESUME TEMPLATE (the only source of truth for her experience — do not add anything not present here):
"""
${templateText}
"""

TARGET JOB POSTING:
Title: ${posting.postingTitle}
Company: ${posting.company ?? 'Unknown'}
Description: ${posting.description ?? 'No description provided'}

Rules:
- Do NOT invent any experience, skill, or qualification that is not already present in the resume template above.
- Do NOT remove any position/role that appears in the resume template — you may reframe, reorder, or re-emphasize existing content, but every position/role must still appear in your output.
- Count the number of distinct positions/roles (jobs held) mentioned in the resume template.
- Produce an adapted version of the resume, tailored to the job posting above, as plain text.

Respond with ONLY a JSON object (no markdown, no commentary, no code fences) with exactly these fields:
{
  "adaptedResumeText": string,
  "originalPositionCount": number,
  "retainedPositionCount": number
}

"originalPositionCount" is how many distinct positions/roles you counted in the resume template.
"retainedPositionCount" is how many of those same positions/roles are still present in "adaptedResumeText".`;
}

export function parseAdaptationResponse(rawText) {
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
  if (
    !parsed ||
    typeof parsed.adaptedResumeText !== 'string' ||
    typeof parsed.originalPositionCount !== 'number' ||
    typeof parsed.retainedPositionCount !== 'number'
  ) {
    throw new Error('OpenAI response was missing required fields');
  }
  return parsed;
}

export async function adaptResumeText(apiKey, templateText, posting) {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: OPENAI_ADAPTATION_MODEL,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: buildAdaptationPrompt(templateText, posting) }]
  });
  return parseAdaptationResponse(response.choices[0]?.message?.content);
}
