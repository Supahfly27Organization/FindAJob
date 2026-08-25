import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp, errorHandler } from '../src/app.js';
import { createDb } from '../src/db/index.js';
import { registerSettingsRoutes } from '../src/routes/settings.js';

let app;

beforeEach(() => {
  const db = createDb(':memory:');
  app = createApp(db);
  registerSettingsRoutes(app, db);
  app.use(errorHandler);
});

describe('GET /api/settings/openai-key', () => {
  it('reports no key configured initially', async () => {
    const response = await request(app).get('/api/settings/openai-key');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ hasKey: false, maskedKey: null });
  });
});

describe('PUT /api/settings/openai-key', () => {
  it('saves a valid key', async () => {
    const response = await request(app)
      .put('/api/settings/openai-key')
      .send({ apiKey: 'sk-abcdefghijklmnop' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ hasKey: true, maskedKey: '••••mnop' });
  });

  it('rejects an invalid key', async () => {
    const response = await request(app)
      .put('/api/settings/openai-key')
      .send({ apiKey: 'nope' });
    expect(response.status).toBe(400);
  });
});
