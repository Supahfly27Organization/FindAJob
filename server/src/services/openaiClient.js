import OpenAI from 'openai';
import {
  OPENAI_SEARCH_MODEL,
  OPENAI_ADAPTATION_MODEL,
  OPENAI_SEARCH_REASONING_EFFORT,
  OPENAI_SEARCH_CONTEXT_SIZE,
  JOB_SEARCH_LOCATION,
  JOB_SEARCH_SOURCES
} from '../config.js';

export const MAX_RESULTS = 20;
export const MAX_AGE_DAYS = 45;
// Asked of each source separately. Deliberately well below MAX_RESULTS (which caps what one
// search *saves* in total, across every source) so a single board can't fill the whole quota.
export const MAX_RESULTS_PER_SOURCE = 8;

export function buildSearchPrompt(title, source) {
  const scope = source?.allowedDomains?.length
    ? `Search ${source.name} (${source.allowedDomains.join(', ')}) — web search is restricted to that site, so do not look elsewhere.`
    : `Search employers' own career pages and any job board not covered elsewhere. Prefer the employer's own site over an aggregator.`;

  return `You are searching for current, real job postings in Israel for the title "${title}" (including reasonably equivalent/synonymous titles).

${scope}

Use web search to find real, currently open job postings. Return at most ${MAX_RESULTS_PER_SOURCE} postings, each published within the last ${MAX_AGE_DAYS} days. (At most ${MAX_RESULTS} will be kept across all sources searched.) Search more than once with different phrasings (English and Hebrew, and synonymous titles) before you answer — a single query will miss most of what is open. Open each posting you intend to return and read it; do not answer from memory.

For each posting, identify:
- "description": what the role actually involves, taken from the posting page — a few sentences of the real ad text, not a summary you composed from the job title.
- "url": the direct application URL — the exact page where a candidate can read the full posting and apply. This must be the posting's own page, never a search-results page, a category/listing page, or a shortened/redirect link. If the posting page you found is on a job aggregator (e.g. LinkedIn, Indeed, AllJobs, Glassdoor) and that aggregator's own posting page is where a candidate would apply, use that aggregator page as "url". Only ever use a URL you actually found via web search — never guess, construct, or approximate one. If you cannot find a working direct posting URL for a result, omit that result entirely rather than inventing one.
- "aggregatorName": the name of the site where you found this listing (e.g. "LinkedIn", "AllJobs", "Indeed", "Glassdoor"), or "Company Career Page" if you found it directly on the employer's own site.
- "aggregatorUrl": the URL of the listing as it appears on that aggregator/source. This may be identical to "url" above, or different if the aggregator only shows a summary that links out elsewhere.

"publishedDate" must be an ISO 8601 date, e.g. "2026-08-01". Set any field you genuinely
could not determine from the posting page to null rather than guessing a value.

If you find no matching postings, return an empty "postings" array.`;
}

// Structured Outputs rather than "respond with ONLY a JSON array" in prose. `strict: true`
// requires every property to be listed in `required` and `additionalProperties: false`, so
// genuinely optional fields are modelled as a string|null union (per the Structured Outputs
// guide) instead of being omitted — postingService already normalises null to null.
const POSTING_PROPERTIES = {
  postingTitle: { type: 'string' },
  description: { type: ['string', 'null'] },
  company: { type: ['string', 'null'] },
  url: { type: 'string' },
  aggregatorName: { type: ['string', 'null'] },
  aggregatorUrl: { type: ['string', 'null'] },
  location: { type: ['string', 'null'] },
  publishedDate: { type: ['string', 'null'] }
};

export const SEARCH_RESPONSE_FORMAT = {
  type: 'json_schema',
  name: 'job_postings',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      postings: {
        type: 'array',
        items: {
          type: 'object',
          properties: POSTING_PROPERTIES,
          required: Object.keys(POSTING_PROPERTIES),
          additionalProperties: false
        }
      }
    },
    required: ['postings'],
    additionalProperties: false
  }
};

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
  // The schema above produces { postings: [...] }; a bare array is still accepted so the
  // fence-stripping fallback path above stays useful if the model ever answers unschema'd.
  const postings = Array.isArray(parsed) ? parsed : parsed?.postings;
  if (!Array.isArray(postings)) {
    throw new Error('OpenAI response was not a JSON array');
  }
  return postings;
}

export function buildSearchTool(source) {
  const tool = {
    type: 'web_search',
    search_context_size: OPENAI_SEARCH_CONTEXT_SIZE,
    user_location: JOB_SEARCH_LOCATION
  };
  if (source?.allowedDomains?.length) {
    tool.filters = { allowed_domains: source.allowedDomains };
  }
  return tool;
}

export function buildSearchRequest(title, source) {
  const request = {
    model: OPENAI_SEARCH_MODEL,
    tools: [buildSearchTool(source)],
    // Without this the model may decide it already knows some Israeli job boards and answer
    // from parametric memory — which is where fabricated URLs come from.
    tool_choice: 'required',
    text: { format: SEARCH_RESPONSE_FORMAT },
    input: buildSearchPrompt(title, source)
  };
  const effort = OPENAI_SEARCH_REASONING_EFFORT?.trim();
  if (effort && effort !== 'none') {
    request.reasoning = { effort };
  }
  return request;
}

export async function searchSource(client, title, source) {
  const response = await client.responses.create(buildSearchRequest(title, source));
  return parseSearchResponse(response.output_text);
}

function dedupeByUrl(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const url = typeof candidate?.url === 'string' ? candidate.url.trim() : null;
    if (!url || seen.has(url)) {
      return false;
    }
    seen.add(url);
    return true;
  });
}

// Round-robin rather than concatenate. `saveSearchResults` keeps only the first MAX_RESULTS
// candidates, and Promise.allSettled resolves in *input* order — so concatenating would let
// the first source in JOB_SEARCH_SOURCES fill the entire quota and starve the rest every
// single time. Interleaving makes the cap take an even spread across the boards searched.
function interleave(lists) {
  const longest = Math.max(0, ...lists.map((list) => list.length));
  const merged = [];
  for (let i = 0; i < longest; i += 1) {
    for (const list of lists) {
      if (i < list.length) {
        merged.push(list[i]);
      }
    }
  }
  return merged;
}

export async function searchJobPostings(apiKey, title, { client, sources = JOB_SEARCH_SOURCES } = {}) {
  const openai = client ?? new OpenAI({ apiKey });
  const settled = await Promise.allSettled(sources.map((source) => searchSource(openai, title, source)));

  const failures = settled.filter((result) => result.status === 'rejected');
  // Every source failing means the problem is the request, not the source (a rejected key,
  // no network) — rethrow the original so searchService can still map a 401 to "key rejected".
  if (settled.length > 0 && failures.length === settled.length) {
    throw failures[0].reason;
  }
  for (const failure of failures) {
    console.error('[search] source failed, continuing with the rest:', failure.reason?.message ?? failure.reason);
  }

  return dedupeByUrl(
    interleave(settled.filter((result) => result.status === 'fulfilled').map((result) => result.value))
  );
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
Description:
"""
${posting.description ?? 'No description provided'}
"""

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
    !Number.isFinite(parsed.originalPositionCount) ||
    !Number.isFinite(parsed.retainedPositionCount)
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
