import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp, errorHandler } from '../src/app.js';
import { createDb } from '../src/db/index.js';
import { registerPositionTitleRoutes } from '../src/routes/positionTitles.js';
import { registerSettingsRoutes } from '../src/routes/settings.js';
import { registerPostingRoutes } from '../src/routes/postings.js';

vi.mock('../src/services/openaiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, searchJobPostings: vi.fn() };
});

import { searchJobPostings } from '../src/services/openaiClient.js';

let app;

beforeEach(() => {
  const db = createDb(':memory:');
  app = createApp(db);
  registerPositionTitleRoutes(app, db);
  registerSettingsRoutes(app, db);
  registerPostingRoutes(app, db);
  app.use(errorHandler);
  vi.mocked(searchJobPostings).mockReset();
});

async function createTitle(title) {
  const response = await request(app).post('/api/position-titles').send({ title });
  return response.body;
}

async function configureApiKey() {
  await request(app).put('/api/settings/openai-key').send({ apiKey: 'sk-test1234567890' });
}

describe('POST /api/position-titles/:id/search', () => {
  it('rejects when no API key is configured', async () => {
    const title = await createTitle('Product Manager');
    const response = await request(app).post(`/api/position-titles/${title.id}/search`);
    expect(response.status).toBe(400);
  });

  it('saves postings returned by the search', async () => {
    const title = await createTitle('Product Manager');
    await configureApiKey();
    vi.mocked(searchJobPostings).mockResolvedValue([
      { postingTitle: 'Senior PM', url: 'https://example.com/job/1', publishedDate: '2026-08-01' }
    ]);

    const response = await request(app).post(`/api/position-titles/${title.id}/search`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ totalFound: 1, savedCount: 1 });
  });

  it('returns 502 when the search call fails', async () => {
    const title = await createTitle('Product Manager');
    await configureApiKey();
    vi.mocked(searchJobPostings).mockRejectedValue(new Error('boom'));

    const response = await request(app).post(`/api/position-titles/${title.id}/search`);
    expect(response.status).toBe(502);
  });
});

describe('GET /api/position-titles/:id/postings', () => {
  it('lists postings found for a title', async () => {
    const title = await createTitle('Product Manager');
    await configureApiKey();
    vi.mocked(searchJobPostings).mockResolvedValue([
      { postingTitle: 'Senior PM', url: 'https://example.com/job/1', publishedDate: '2026-08-01' }
    ]);
    await request(app).post(`/api/position-titles/${title.id}/search`);

    const response = await request(app).get(`/api/position-titles/${title.id}/postings`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ postingTitle: 'Senior PM', viewed: false, status: 'New' });
  });

  it('returns 404 for a missing title', async () => {
    const response = await request(app).get('/api/position-titles/999/postings');
    expect(response.status).toBe(404);
  });
});

describe('PUT /api/postings/:id/viewed', () => {
  it('marks a posting viewed', async () => {
    const title = await createTitle('Product Manager');
    await configureApiKey();
    vi.mocked(searchJobPostings).mockResolvedValue([
      { postingTitle: 'Senior PM', url: 'https://example.com/job/1' }
    ]);
    await request(app).post(`/api/position-titles/${title.id}/search`);
    const [posting] = (await request(app).get(`/api/position-titles/${title.id}/postings`)).body;

    const response = await request(app).put(`/api/postings/${posting.id}/viewed`);
    expect(response.status).toBe(200);
    expect(response.body.viewed).toBe(true);
  });

  it('returns 404 for a missing posting', async () => {
    const response = await request(app).put('/api/postings/999/viewed');
    expect(response.status).toBe(404);
  });
});

describe('PUT /api/postings/:id/status', () => {
  it('updates to a valid status', async () => {
    const title = await createTitle('Product Manager');
    await configureApiKey();
    vi.mocked(searchJobPostings).mockResolvedValue([
      { postingTitle: 'Senior PM', url: 'https://example.com/job/1' }
    ]);
    await request(app).post(`/api/position-titles/${title.id}/search`);
    const [posting] = (await request(app).get(`/api/position-titles/${title.id}/postings`)).body;

    const response = await request(app)
      .put(`/api/postings/${posting.id}/status`)
      .send({ status: 'In Progress' });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('In Progress');
  });

  it('rejects "Applied" via this endpoint', async () => {
    const title = await createTitle('Product Manager');
    await configureApiKey();
    vi.mocked(searchJobPostings).mockResolvedValue([
      { postingTitle: 'Senior PM', url: 'https://example.com/job/1' }
    ]);
    await request(app).post(`/api/position-titles/${title.id}/search`);
    const [posting] = (await request(app).get(`/api/position-titles/${title.id}/postings`)).body;

    const response = await request(app)
      .put(`/api/postings/${posting.id}/status`)
      .send({ status: 'Applied' });
    expect(response.status).toBe(400);
  });

  it('returns 404 for a missing posting', async () => {
    const response = await request(app).put('/api/postings/999/status').send({ status: 'Rejected' });
    expect(response.status).toBe(404);
  });
});
