import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.join(__dirname, '..', '..');

// Loaded here (config.js is imported before anything else that reads process.env) so
// OPENAI_API_KEY works from the repo-root .env regardless of the cwd the app was started
// from (npm workspace scripts run with cwd set to server/, not the repo root).
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

export const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
export const DB_PATH =
  process.env.FINDAJOB_DB_PATH || path.join(__dirname, '..', 'data', 'findajob.db');
export const CLIENT_DIST_PATH = path.join(__dirname, '..', '..', 'client', 'dist');
export const DATA_DIR = path.dirname(DB_PATH);
export const ADAPTED_RESUMES_DIR = path.join(DATA_DIR, 'adapted-resumes');
export const APPLIED_CVS_DIR = path.join(DATA_DIR, 'applied-cvs');
export const OPENAI_ADAPTATION_MODEL = process.env.OPENAI_ADAPTATION_MODEL || 'gpt-4.1';

// --- Search tuning -------------------------------------------------------------------
// A reasoning model, not gpt-4.1: ChatGPT's web search feels better than a plain API call
// largely because it searches, reads, notices a gap, and searches again. A non-reasoning
// model fires one query and answers. That loop is what `reasoning.effort` buys here.
export const OPENAI_SEARCH_MODEL = process.env.OPENAI_SEARCH_MODEL || 'gpt-5.6-terra';
// Set to '' or 'none' when pointing OPENAI_SEARCH_MODEL at a non-reasoning model
// (e.g. gpt-4.1) — the `reasoning` param is rejected outright by those.
export const OPENAI_SEARCH_REASONING_EFFORT = process.env.OPENAI_SEARCH_REASONING_EFFORT ?? 'high';
// low | medium | high. Default is medium; we ask for high because each result needs a
// description, company, location and published date extracted from the page, not just a link.
export const OPENAI_SEARCH_CONTEXT_SIZE = process.env.OPENAI_SEARCH_CONTEXT_SIZE || 'high';

// Without this the web_search tool retrieves unlocalized (US-skewed) results, which is the
// single biggest accuracy gap versus asking ChatGPT — it knows where the user is, the raw
// API call does not. Overridable for anyone job-hunting somewhere else.
export const JOB_SEARCH_LOCATION = {
  type: 'approximate',
  country: process.env.JOB_SEARCH_COUNTRY || 'IL',
  city: process.env.JOB_SEARCH_CITY || 'Tel Aviv',
  region: process.env.JOB_SEARCH_REGION || 'Tel Aviv',
  timezone: process.env.JOB_SEARCH_TIMEZONE || 'Asia/Jerusalem'
};

// One search call per source rather than one call total. Two reasons: the model no longer
// gets to pick which board to look at (that choice was sampled, and was the main reason two
// clicks seconds apart returned disjoint result sets), and unioning several runs averages
// out the residual per-call randomness. `allowedDomains: null` means "no domain filter" —
// that call covers company career pages and boards not listed here.
export const JOB_SEARCH_SOURCES = [
  { name: 'AllJobs', allowedDomains: ['alljobs.co.il'] },
  { name: 'Drushim', allowedDomains: ['drushim.co.il'] },
  { name: 'JobMaster', allowedDomains: ['jobmaster.co.il'] },
  { name: 'LinkedIn', allowedDomains: ['linkedin.com'] },
  { name: 'Indeed', allowedDomains: ['indeed.com'] },
  { name: 'Company career pages', allowedDomains: null }
];

// The resume template is a file the user drops at the repo root — there is no upload UI.
// First match wins; `.docx` is the documented default.
export const RESUME_TEMPLATE_FORMATS = ['docx', 'pdf', 'txt', 'md'];
export const resumeTemplatePathFor = (format) => path.join(ROOT_DIR, `Resume.${format}`);

// The only source of the OpenAI key: OPENAI_API_KEY in the repo-root .env (loaded above).
export function getOpenAiKey() {
  const key = process.env.OPENAI_API_KEY;
  return typeof key === 'string' && key.trim() ? key.trim() : null;
}
