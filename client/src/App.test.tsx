import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('defaults to the Position Titles page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }) as Response)
    );
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: /position titles/i })).toBeInTheDocument();
  });

  it('has no Settings link — the OpenAI key and resume template are files, not UI', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }) as Response)
    );
    render(
      <MemoryRouter initialEntries={['/titles']}>
        <App />
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /position titles/i });
    expect(screen.queryByRole('link', { name: /settings/i })).not.toBeInTheDocument();
  });

  it('redirects an unknown route back to Position Titles', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }) as Response)
    );
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: /position titles/i })).toBeInTheDocument();
  });
});
