import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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

function renderPage() {
  return render(
    <MemoryRouter>
      <PositionTitlesPage />
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PositionTitlesPage', () => {
  it('shows an empty state when there are no titles', async () => {
    mockFetchSequence([{ status: 200, body: [] }]);
    renderPage();
    expect(await screen.findByText(/no position titles yet/i)).toBeInTheDocument();
  });

  it('lists titles with their posting counts', async () => {
    mockFetchSequence([
      { status: 200, body: [{ id: 1, title: 'Product Manager', createdAt: '', postingCount: 4 }] }
    ]);
    renderPage();
    expect(await screen.findByText('Product Manager')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('adds a new title and refreshes the list', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: [] },
      { status: 201, body: { id: 1, title: 'QA Engineer', createdAt: '' } },
      { status: 200, body: [{ id: 1, title: 'QA Engineer', createdAt: '', postingCount: 0 }] }
    ]);
    renderPage();
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
    renderPage();
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
    renderPage();
    await screen.findByText('QA Engineer');

    await user.click(screen.getByRole('button', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(await screen.findByText(/no position titles yet/i)).toBeInTheDocument();
  });

  it('shows an error when deleting fails', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: [{ id: 1, title: 'QA Engineer', createdAt: '', postingCount: 0 }] },
      { status: 500, body: { message: 'Failed to delete title' } }
    ]);
    renderPage();
    await screen.findByText('QA Engineer');

    await user.click(screen.getByRole('button', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to delete title');
  });

  it('links to the postings page for a title', async () => {
    mockFetchSequence([
      { status: 200, body: [{ id: 1, title: 'QA Engineer', createdAt: '', postingCount: 0 }] }
    ]);
    renderPage();
    await screen.findByText('QA Engineer');

    expect(screen.getByRole('link', { name: /view postings/i })).toHaveAttribute(
      'href',
      '/titles/1/postings'
    );
  });

  it('runs a search for one title and refreshes its posting count', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: [{ id: 1, title: 'QA Engineer', createdAt: '', postingCount: 0 }] },
      { status: 200, body: { totalFound: 2, savedCount: 2 } },
      { status: 200, body: [{ id: 1, title: 'QA Engineer', createdAt: '', postingCount: 2 }] }
    ]);
    renderPage();
    await screen.findByText('QA Engineer');

    await user.click(screen.getByRole('button', { name: /search now/i }));

    expect(await screen.findByText('2')).toBeInTheDocument();
  });

  it('shows a retry option when a search fails', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: [{ id: 1, title: 'QA Engineer', createdAt: '', postingCount: 0 }] },
      { status: 400, body: { message: 'Configure your OpenAI API key in Settings before searching.' } }
    ]);
    renderPage();
    await screen.findByText('QA Engineer');

    await user.click(screen.getByRole('button', { name: /search now/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Configure your OpenAI API key in Settings before searching.'
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('disables "Search all" when there are no titles', async () => {
    mockFetchSequence([{ status: 200, body: [] }]);
    renderPage();
    await screen.findByText(/no position titles yet/i);

    expect(screen.getByRole('button', { name: /search all/i })).toBeDisabled();
  });

  it('searches every title in sequence when "Search all" is clicked', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      {
        status: 200,
        body: [
          { id: 1, title: 'QA Engineer', createdAt: '', postingCount: 0 },
          { id: 2, title: 'Product Manager', createdAt: '', postingCount: 0 }
        ]
      },
      { status: 200, body: { totalFound: 1, savedCount: 1 } },
      {
        status: 200,
        body: [
          { id: 1, title: 'QA Engineer', createdAt: '', postingCount: 1 },
          { id: 2, title: 'Product Manager', createdAt: '', postingCount: 0 }
        ]
      },
      { status: 200, body: { totalFound: 1, savedCount: 1 } },
      {
        status: 200,
        body: [
          { id: 1, title: 'QA Engineer', createdAt: '', postingCount: 1 },
          { id: 2, title: 'Product Manager', createdAt: '', postingCount: 1 }
        ]
      }
    ]);
    renderPage();
    await screen.findByText('QA Engineer');

    await user.click(screen.getByRole('button', { name: /search all/i }));

    const counts = await screen.findAllByText('1');
    expect(counts).toHaveLength(2);
  });
});
