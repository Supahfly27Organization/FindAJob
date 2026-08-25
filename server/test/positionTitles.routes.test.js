import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp, errorHandler } from '../src/app.js';
import { createDb } from '../src/db/index.js';
import { registerPositionTitleRoutes } from '../src/routes/positionTitles.js';

let app;

beforeEach(() => {
  const db = createDb(':memory:');
  app = createApp(db);
  registerPositionTitleRoutes(app, db);
  app.use(errorHandler);
});

describe('POST /api/position-titles', () => {
  it('creates a title', async () => {
    const response = await request(app)
      .post('/api/position-titles')
      .send({ title: 'Product Manager' });
    expect(response.status).toBe(201);
    expect(response.body.title).toBe('Product Manager');
  });

  it('rejects an empty title', async () => {
    const response = await request(app).post('/api/position-titles').send({ title: '  ' });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Title is required');
  });

  it('rejects a duplicate title', async () => {
    await request(app).post('/api/position-titles').send({ title: 'Product Manager' });
    const response = await request(app)
      .post('/api/position-titles')
      .send({ title: 'product manager' });
    expect(response.status).toBe(400);
  });
});

describe('GET /api/position-titles', () => {
  it('lists titles with posting counts', async () => {
    await request(app).post('/api/position-titles').send({ title: 'QA Engineer' });
    const response = await request(app).get('/api/position-titles');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({ title: 'QA Engineer', postingCount: 0 })
    ]);
  });
});

describe('PUT /api/position-titles/:id', () => {
  it('updates a title', async () => {
    const created = await request(app)
      .post('/api/position-titles')
      .send({ title: 'Product Manger' });
    const response = await request(app)
      .put(`/api/position-titles/${created.body.id}`)
      .send({ title: 'Product Manager' });
    expect(response.status).toBe(200);
    expect(response.body.title).toBe('Product Manager');
  });

  it('returns 404 for a missing title', async () => {
    const response = await request(app)
      .put('/api/position-titles/999')
      .send({ title: 'Anything' });
    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/position-titles/:id', () => {
  it('deletes a title and reports unlinked postings', async () => {
    const created = await request(app).post('/api/position-titles').send({ title: 'QA Engineer' });
    const response = await request(app).delete(`/api/position-titles/${created.body.id}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ unlinkedPostingsCount: 0 });
  });
});
