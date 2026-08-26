import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    // A real OPENAI_API_KEY in the repo-root .env would otherwise win over the DB-stored
    // key in every test (config.js loads that .env), breaking the "no key configured" cases.
    // Blank (not unset) so dotenv's "don't override what's already set" rule keeps it blank.
    env: { OPENAI_API_KEY: '' }
  }
});
