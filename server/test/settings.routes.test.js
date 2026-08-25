import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp, errorHandler } from '../src/app.js';
import { createDb } from '../src/db/index.js';
import { registerSettingsRoutes } from '../src/routes/settings.js';
import fs from 'node:fs';
import { RESUME_TEMPLATE_DIR } from '../src/config.js';

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

describe('GET /api/settings/resume-template', () => {
  it('reports no template configured initially', async () => {
    const response = await request(app).get('/api/settings/resume-template');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ hasTemplate: false, originalName: null, format: null });
  });
});

describe('POST /api/settings/resume-template', () => {
  afterEach(() => {
    fs.rmSync(RESUME_TEMPLATE_DIR, { recursive: true, force: true });
  });

  it('saves an uploaded .txt template', async () => {
    const response = await request(app)
      .post('/api/settings/resume-template')
      .attach('file', Buffer.from('Jane Doe'), 'resume.txt');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ hasTemplate: true, originalName: 'resume.txt', format: 'txt' });
  });

  it('rejects an unsupported file format', async () => {
    const response = await request(app)
      .post('/api/settings/resume-template')
      .attach('file', Buffer.from('x'), 'resume.pages');
    expect(response.status).toBe(400);
  });

  it('rejects a Multer error other than LIMIT_FILE_SIZE (e.g. wrong form field name) with a ValidationError, not a 500', async () => {
    const response = await request(app)
      .post('/api/settings/resume-template')
      .attach('wrongFieldName', Buffer.from('Jane Doe'), 'resume.txt');
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/could not process the uploaded file/i);
  });
});
