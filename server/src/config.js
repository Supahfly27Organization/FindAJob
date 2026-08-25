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
export const OPENAI_SEARCH_MODEL = process.env.OPENAI_SEARCH_MODEL || 'gpt-4.1';
export const DATA_DIR = path.dirname(DB_PATH);
export const RESUME_TEMPLATE_DIR = path.join(DATA_DIR, 'resume-template');
export const ADAPTED_RESUMES_DIR = path.join(DATA_DIR, 'adapted-resumes');
export const OPENAI_ADAPTATION_MODEL = process.env.OPENAI_ADAPTATION_MODEL || 'gpt-4.1';
export const FIXED_RESUME_TEMPLATE_PATH = path.join(ROOT_DIR, 'Resume.docx');
