import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp, errorHandler } from '../src/app.js';
import { createDb } from '../src/db/index.js';
import { registerPositionTitleRoutes } from '../src/routes/positionTitles.js';
import { registerPostingRoutes } from '../src/routes/postings.js';

vi.mock('../src/services/openaiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, searchJobPostings: vi.fn(), adaptResumeText: vi.fn() };
});

import { searchJobPostings, adaptResumeText } from '../src/services/openaiClient.js';
import fs from 'node:fs';
import {
  ADAPTED_RESUMES_DIR,
  APPLIED_CVS_DIR,
  RESUME_TEMPLATE_FORMATS,
  resumeTemplatePathFor
} from '../src/config.js';

let app;

beforeEach(() => {
  const db = createDb(':memory:');
  app = createApp(db);
  registerPositionTitleRoutes(app, db);
  registerPostingRoutes(app, db);
  app.use(errorHandler);
  vi.mocked(searchJobPostings).mockReset();
  vi.mocked(adaptResumeText).mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function removeResumeTemplates() {
  for (const format of RESUME_TEMPLATE_FORMATS) {
    fs.rmSync(resumeTemplatePathFor(format), { force: true });
  }
}

async function createTitle(title) {
  const response = await request(app).post('/api/position-titles').send({ title });
  return response.body;
}

function configureApiKey() {
  vi.stubEnv('OPENAI_API_KEY', 'sk-test1234567890');
}

async function createPostingWithTemplate() {
  const title = await createTitle('Product Manager');
  configureApiKey();
  vi.mocked(searchJobPostings).mockResolvedValue([
    { postingTitle: 'Senior PM', url: 'https://example.com/job/1' }
  ]);
  await request(app).post(`/api/position-titles/${title.id}/search`);
  const [posting] = (await request(app).get(`/api/position-titles/${title.id}/postings`)).body;
  fs.writeFileSync(resumeTemplatePathFor('txt'), 'Jane Doe');
  return posting;
}

describe('POST /api/position-titles/:id/search', () => {
  it('rejects when no API key is configured', async () => {
    const title = await createTitle('Product Manager');
    const response = await request(app).post(`/api/position-titles/${title.id}/search`);
    expect(response.status).toBe(400);
  });

  it('saves postings returned by the search', async () => {
    const title = await createTitle('Product Manager');
    configureApiKey();
    vi.mocked(searchJobPostings).mockResolvedValue([
      { postingTitle: 'Senior PM', url: 'https://example.com/job/1', publishedDate: '2026-08-01' }
    ]);

    const response = await request(app).post(`/api/position-titles/${title.id}/search`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ totalFound: 1, savedCount: 1 });
  });

  it('returns 502 when the search call fails', async () => {
    const title = await createTitle('Product Manager');
    configureApiKey();
    vi.mocked(searchJobPostings).mockRejectedValue(new Error('boom'));

    const response = await request(app).post(`/api/position-titles/${title.id}/search`);
    expect(response.status).toBe(502);
  });
});

describe('GET /api/position-titles/:id/postings', () => {
  it('lists postings found for a title', async () => {
    const title = await createTitle('Product Manager');
    configureApiKey();
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
    configureApiKey();
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
    configureApiKey();
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
    configureApiKey();
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

describe('POST /api/postings/:id/adapt-resume', () => {
  afterEach(() => {
    removeResumeTemplates();
    fs.rmSync(ADAPTED_RESUMES_DIR, { recursive: true, force: true });
  });

  it('adapts and saves a resume for a posting', async () => {
    const posting = await createPostingWithTemplate();
    vi.mocked(adaptResumeText).mockResolvedValue({
      adaptedResumeText: 'Jane Doe, tailored',
      originalPositionCount: 1,
      retainedPositionCount: 1
    });

    const response = await request(app).post(`/api/postings/${posting.id}/adapt-resume`);
    expect(response.status).toBe(200);
    expect(response.body.adaptedResumePath).toMatch(/posting-\d+\.txt$/);
  });

  it('rejects when no resume template is configured', async () => {
    const title = await createTitle('Product Manager');
    configureApiKey();
    vi.mocked(searchJobPostings).mockResolvedValue([
      { postingTitle: 'Senior PM', url: 'https://example.com/job/1' }
    ]);
    await request(app).post(`/api/position-titles/${title.id}/search`);
    const [posting] = (await request(app).get(`/api/position-titles/${title.id}/postings`)).body;

    const response = await request(app).post(`/api/postings/${posting.id}/adapt-resume`);
    expect(response.status).toBe(400);
  });

  it('returns 404 for a missing posting', async () => {
    fs.writeFileSync(resumeTemplatePathFor('txt'), 'Jane Doe');
    const response = await request(app).post('/api/postings/999/adapt-resume');
    expect(response.status).toBe(404);
  });
});

describe('GET /api/postings/:id/adapted-resume', () => {
  afterEach(() => {
    removeResumeTemplates();
    fs.rmSync(ADAPTED_RESUMES_DIR, { recursive: true, force: true });
  });

  it('downloads the adapted resume file', async () => {
    const posting = await createPostingWithTemplate();
    vi.mocked(adaptResumeText).mockResolvedValue({
      adaptedResumeText: 'Jane Doe, tailored',
      originalPositionCount: 1,
      retainedPositionCount: 1
    });
    await request(app).post(`/api/postings/${posting.id}/adapt-resume`);

    const response = await request(app).get(`/api/postings/${posting.id}/adapted-resume`);
    expect(response.status).toBe(200);
    expect(response.text).toBe('Jane Doe, tailored');
  });

  it('returns 404 when no adapted resume exists yet', async () => {
    const posting = await createPostingWithTemplate();
    const response = await request(app).get(`/api/postings/${posting.id}/adapted-resume`);
    expect(response.status).toBe(404);
  });
});

describe('applied CV upload and download', () => {
  afterEach(() => {
    fs.rmSync(APPLIED_CVS_DIR, { recursive: true, force: true });
  });

  async function createPosting() {
    const title = await createTitle('Product Manager');
    configureApiKey();
    vi.mocked(searchJobPostings).mockResolvedValue([
      { postingTitle: 'Senior PM', url: 'https://example.com/job/1' }
    ]);
    await request(app).post(`/api/position-titles/${title.id}/search`);
    const [posting] = (await request(app).get(`/api/position-titles/${title.id}/postings`)).body;
    return posting;
  }

  it('uploads a CV and marks the posting Applied', async () => {
    const posting = await createPosting();

    const response = await request(app)
      .post(`/api/postings/${posting.id}/applied-cv`)
      .attach('file', Buffer.from('submitted cv'), 'my-cv.txt');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'Applied', appliedCvOriginalName: 'my-cv.txt' });
  });

  it('rejects an unsupported format and leaves the status unchanged', async () => {
    const posting = await createPosting();

    const response = await request(app)
      .post(`/api/postings/${posting.id}/applied-cv`)
      .attach('file', Buffer.from('nope'), 'my-cv.pages');

    expect(response.status).toBe(400);
    const [current] = (await request(app).get(`/api/position-titles/${posting.positionTitleId}/postings`)).body;
    expect(current.status).toBe('New');
  });

  it('returns 400 when no file is attached', async () => {
    const posting = await createPosting();
    const response = await request(app).post(`/api/postings/${posting.id}/applied-cv`);
    expect(response.status).toBe(400);
  });

  it('returns 404 for a missing posting', async () => {
    const response = await request(app)
      .post('/api/postings/999/applied-cv')
      .attach('file', Buffer.from('cv'), 'my-cv.txt');
    expect(response.status).toBe(404);
  });

  it('downloads the uploaded CV under its original filename', async () => {
    const posting = await createPosting();
    await request(app)
      .post(`/api/postings/${posting.id}/applied-cv`)
      .attach('file', Buffer.from('submitted cv'), 'my-cv.txt');

    const response = await request(app).get(`/api/postings/${posting.id}/applied-cv`);
    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toContain('my-cv.txt');
    expect(response.text).toBe('submitted cv');
  });

  it('returns 404 when downloading before any CV was uploaded', async () => {
    const posting = await createPosting();
    const response = await request(app).get(`/api/postings/${posting.id}/applied-cv`);
    expect(response.status).toBe(404);
  });
});
