import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PositionTitlesPage from './PositionTitlesPage';

function mockFetchSequence(responses: Array<{ status: number; body: unknown }>) {
  let call = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const response = responses[Math.min(call, responses.length - 1)];
      call += 1;
      return {
        ok: response.status < 400,
        status: response.status,
        json: async () => response.body
      } as Response;
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PositionTitlesPage', () => {
  it('shows an empty state when there are no titles', async () => {
    mockFetchSequence([{ status: 200, body: [] }]);
    render(<PositionTitlesPage />);
    expect(await screen.findByText(/no position titles yet/i)).toBeInTheDocument();
  });

  it('lists titles with their posting counts', async () => {
    mockFetchSequence([
      { status: 200, body: [{ id: 1, title: 'Product Manager', createdAt: '', postingCount: 4 }] }
    ]);
    render(<PositionTitlesPage />);
    expect(await screen.findByText('Product Manager')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('adds a new title and refreshes the list', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: [] },
      { status: 201, body: { id: 1, title: 'QA Engineer', createdAt: '', postingCount: 0 } },
      { status: 200, body: [{ id: 1, title: 'QA Engineer', createdAt: '', postingCount: 0 }] }
    ]);
    render(<PositionTitlesPage />);
    await screen.findByText(/no position titles yet/i);

    await user.type(screen.getByLabelText(/new position title/i), 'QA Engineer');
    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(await screen.findByText('QA Engineer')).toBeInTheDocument();
  });

  it('shows a validation error from the server when adding fails', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: [] },
      { status: 400, body: { message: 'This title is already in your list' } }
    ]);
    render(<PositionTitlesPage />);
    await screen.findByText(/no position titles yet/i);

    await user.type(screen.getByLabelText(/new position title/i), 'QA Engineer');
    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This title is already in your list'
    );
  });

  it('deletes a title after confirming', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: [{ id: 1, title: 'QA Engineer', createdAt: '', postingCount: 0 }] },
      { status: 200, body: { unlinkedPostingsCount: 0 } },
      { status: 200, body: [] }
    ]);
    render(<PositionTitlesPage />);
    await screen.findByText('QA Engineer');

    await user.click(screen.getByRole('button', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(await screen.findByText(/no position titles yet/i)).toBeInTheDocument();
  });
});
