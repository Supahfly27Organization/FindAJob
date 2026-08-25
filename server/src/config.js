import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
export const DB_PATH =
  process.env.FINDAJOB_DB_PATH || path.join(__dirname, '..', 'data', 'findajob.db');
export const CLIENT_DIST_PATH = path.join(__dirname, '..', '..', 'client', 'dist');
export const OPENAI_SEARCH_MODEL = process.env.OPENAI_SEARCH_MODEL || 'gpt-4.1';
