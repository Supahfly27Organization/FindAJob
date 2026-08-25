import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('navigates to Settings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }) as Response)
    );
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/titles']}>
        <App />
      </MemoryRouter>
    );
    await user.click(screen.getByRole('link', { name: /settings/i }));
    expect(await screen.findByRole('heading', { name: /settings/i })).toBeInTheDocument();
  });
});
