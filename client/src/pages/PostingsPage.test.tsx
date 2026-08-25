import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PostingsPage from './PostingsPage';

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
    <MemoryRouter initialEntries={['/titles/1/postings']}>
      <Routes>
        <Route path="/titles/:id/postings" element={<PostingsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const TITLES = [{ id: 1, title: 'Product Manager', createdAt: '2026-08-01', postingCount: 1 }];

const POSTING = {
  id: 10,
  positionTitleId: 1,
  postingTitle: 'Senior PM',
  description: 'Great role',
  company: 'Acme',
  url: 'https://example.com/job/1',
  location: 'Tel Aviv',
  publishedDate: '2026-08-01',
  foundAt: '2026-08-01',
  viewed: false,
  status: 'New',
  adaptedResumePath: null,
  appliedCvPath: null
};

describe('PostingsPage', () => {
  it('shows an empty state when there are no postings yet', async () => {
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [] }
    ]);
    renderPage();
    expect(await screen.findByText(/no postings found yet/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /postings for product manager/i })).toBeInTheDocument();
  });

  it('lists postings with their details', async () => {
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [POSTING] }
    ]);
    renderPage();
    expect(await screen.findByText('Senior PM')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('runs a search and reports zero matches', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [] },
      { status: 200, body: { totalFound: 0, savedCount: 0 } },
      { status: 200, body: TITLES },
      { status: 200, body: [] }
    ]);
    renderPage();
    await screen.findByText(/no postings found yet/i);

    await user.click(screen.getByRole('button', { name: /search now/i }));

    expect(await screen.findByText(/no matching postings found in the last 45 days/i)).toBeInTheDocument();
  });

  it('reports all-duplicates distinctly from zero matches', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [] },
      { status: 200, body: { totalFound: 2, savedCount: 0 } },
      { status: 200, body: TITLES },
      { status: 200, body: [] }
    ]);
    renderPage();
    await screen.findByText(/no postings found yet/i);

    await user.click(screen.getByRole('button', { name: /search now/i }));

    expect(
      await screen.findByText('No new postings — all 2 results were already in your list.')
    ).toBeInTheDocument();
  });

  it('shows a search error', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [] },
      { status: 400, body: { message: 'Configure your OpenAI API key in Settings before searching.' } }
    ]);
    renderPage();
    await screen.findByText(/no postings found yet/i);

    await user.click(screen.getByRole('button', { name: /search now/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Configure your OpenAI API key in Settings before searching.'
    );
  });

  it('marks a posting viewed when opened', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [POSTING] },
      { status: 200, body: { ...POSTING, viewed: true } }
    ]);
    vi.stubGlobal('open', vi.fn());
    renderPage();
    await screen.findByText('Senior PM');

    await user.click(screen.getByRole('button', { name: /open/i }));

    expect(window.open).toHaveBeenCalledWith('https://example.com/job/1', '_blank', 'noopener,noreferrer');
    expect(await screen.findByText('Yes')).toBeInTheDocument();
  });

  it('updates status via the select control', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [POSTING] },
      { status: 200, body: { ...POSTING, status: 'In Progress' } }
    ]);
    renderPage();
    await screen.findByText('Senior PM');

    await user.selectOptions(screen.getByLabelText(/status for senior pm/i), 'In Progress');

    expect(await screen.findByDisplayValue('In Progress')).toBeInTheDocument();
  });

  it('generates an adapted resume and shows a download link', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [POSTING] },
      { status: 200, body: { ...POSTING, adaptedResumePath: '/data/adapted-resumes/posting-10.docx' } }
    ]);
    renderPage();
    await screen.findByText('Senior PM');

    await user.click(screen.getByRole('button', { name: /adapt my resume/i }));

    expect(await screen.findByRole('link', { name: /download adapted resume/i })).toBeInTheDocument();
  });

  it('shows an error when adaptation fails', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [POSTING] },
      { status: 400, body: { message: 'Configure your resume template in Settings before adapting your resume.' } }
    ]);
    renderPage();
    await screen.findByText('Senior PM');

    await user.click(screen.getByRole('button', { name: /adapt my resume/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Configure your resume template in Settings before adapting your resume.'
    );
  });

  it('confirms before replacing an existing adapted resume', async () => {
    const user = userEvent.setup();
    const postingWithResume = { ...POSTING, adaptedResumePath: '/data/adapted-resumes/posting-10.docx' };
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [postingWithResume] },
      { status: 200, body: postingWithResume }
    ]);
    renderPage();
    await screen.findByText('Senior PM');

    await user.click(screen.getByRole('button', { name: /re-adapt resume/i }));
    expect(screen.getByText(/replace existing adapted resume/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /yes, replace/i }));
    expect(await screen.findByRole('link', { name: /download adapted resume/i })).toBeInTheDocument();
  });
});
