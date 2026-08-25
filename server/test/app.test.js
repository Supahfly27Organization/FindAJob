import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp, errorHandler } from '../src/app.js';
import { createDb } from '../src/db/index.js';

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const db = createDb(':memory:');
    const app = createApp(db);
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

function mockResponse() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler', () => {
  it('uses the error status and message when present', () => {
    const res = mockResponse();
    errorHandler({ status: 404, message: 'Not found' }, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not found' });
  });

  it('falls back to 500 for unexpected errors', () => {
    const res = mockResponse();
    const originalError = console.error;
    console.error = vi.fn();
    errorHandler(new Error('boom'), {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    console.error = originalError;
  });
});
