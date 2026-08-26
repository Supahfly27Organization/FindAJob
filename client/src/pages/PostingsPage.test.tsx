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
  aggregatorName: null,
  aggregatorUrl: null,
  location: 'Tel Aviv',
  publishedDate: '2026-08-01',
  foundAt: '2026-08-01',
  viewed: false,
  status: 'New',
  adaptedResumePath: null,
  appliedCvPath: null,
  appliedCvOriginalName: null
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

  it('shows a dash for the source when no aggregator was found', async () => {
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [POSTING] }
    ]);
    renderPage();
    await screen.findByText('Senior PM');
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows the aggregator name as a link to its listing', async () => {
    const postingWithAggregator = {
      ...POSTING,
      aggregatorName: 'LinkedIn',
      aggregatorUrl: 'https://www.linkedin.com/jobs/view/12345'
    };
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [postingWithAggregator] }
    ]);
    renderPage();
    await screen.findByText('Senior PM');

    const link = screen.getByRole('link', { name: 'LinkedIn' });
    expect(link).toHaveAttribute('href', 'https://www.linkedin.com/jobs/view/12345');
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
      { status: 400, body: { message: 'Set OPENAI_API_KEY in the .env file at the project root, then restart the app.' } }
    ]);
    renderPage();
    await screen.findByText(/no postings found yet/i);

    await user.click(screen.getByRole('button', { name: /search now/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Set OPENAI_API_KEY in the .env file at the project root, then restart the app.'
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

    await user.click(screen.getByRole('button', { name: /adapt resume for senior pm/i }));

    expect(await screen.findByRole('link', { name: /download adapted resume for senior pm/i })).toBeInTheDocument();
  });

  it('shows an error when adaptation fails', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [POSTING] },
      { status: 400, body: { message: 'Add your resume as Resume.docx in the project root before adapting your resume.' } }
    ]);
    renderPage();
    await screen.findByText('Senior PM');

    await user.click(screen.getByRole('button', { name: /adapt resume for senior pm/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Add your resume as Resume.docx in the project root before adapting your resume.'
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

    await user.click(screen.getByRole('button', { name: /adapt resume for senior pm/i }));
    expect(screen.getByText(/replace existing adapted resume/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /yes, replace resume for senior pm/i }));
    expect(await screen.findByRole('link', { name: /download adapted resume for senior pm/i })).toBeInTheDocument();
  });

  it('does not close an unrelated posting\'s replace-confirm when adapting a different posting', async () => {
    const user = userEvent.setup();
    const postingWithResume = { ...POSTING, id: 10, postingTitle: 'Senior PM', adaptedResumePath: '/data/adapted-resumes/posting-10.docx' };
    const postingWithoutResume = { ...POSTING, id: 11, postingTitle: 'Junior PM', adaptedResumePath: null };
    mockFetchSequence([
      { status: 200, body: TITLES },
      { status: 200, body: [postingWithResume, postingWithoutResume] },
      { status: 200, body: { ...postingWithoutResume, adaptedResumePath: '/data/adapted-resumes/posting-11.docx' } }
    ]);
    renderPage();
    await screen.findByText('Senior PM');

    await user.click(screen.getByRole('button', { name: /adapt resume for senior pm/i }));
    expect(screen.getByText(/replace existing adapted resume/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /adapt resume for junior pm/i }));

    expect(screen.getByText(/replace existing adapted resume/i)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /download adapted resume for junior pm/i })).toBeInTheDocument();
  });

  describe('marking a posting Applied', () => {
    const APPLIED = {
      ...POSTING,
      status: 'Applied',
      appliedCvPath: '/data/applied-cvs/posting-10.docx',
      appliedCvOriginalName: 'my-cv.docx'
    };

    async function openUploadPanel() {
      const user = userEvent.setup();
      await screen.findByText('Senior PM');
      await user.selectOptions(screen.getByLabelText(/status for senior pm/i), 'Applied');
      return user;
    }

    it('opens the CV upload panel instead of changing status immediately', async () => {
      mockFetchSequence([
        { status: 200, body: TITLES },
        { status: 200, body: [POSTING] }
      ]);
      renderPage();
      await openUploadPanel();

      expect(
        screen.getByRole('dialog', { name: /upload the cv you used for senior pm/i })
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/status for senior pm/i)).toHaveValue('New');
    });

    it('uploads the CV, marks the posting Applied and shows a download link', async () => {
      mockFetchSequence([
        { status: 200, body: TITLES },
        { status: 200, body: [POSTING] },
        { status: 200, body: APPLIED }
      ]);
      renderPage();
      const user = await openUploadPanel();

      await user.upload(
        screen.getByLabelText(/cv file used for senior pm/i),
        new File(['cv'], 'my-cv.docx', { type: 'application/octet-stream' })
      );
      await user.click(screen.getByRole('button', { name: /upload applied cv for senior pm/i }));

      expect(await screen.findByDisplayValue('Applied')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /download applied cv for senior pm/i })
      ).toHaveAttribute('href', '/api/postings/10/applied-cv');
    });

    it('does not change the status when the panel is cancelled', async () => {
      mockFetchSequence([
        { status: 200, body: TITLES },
        { status: 200, body: [POSTING] }
      ]);
      renderPage();
      const user = await openUploadPanel();

      await user.click(screen.getByRole('button', { name: /cancel applied cv upload for senior pm/i }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByLabelText(/status for senior pm/i)).toHaveValue('New');
    });

    it('requires a file before uploading', async () => {
      mockFetchSequence([
        { status: 200, body: TITLES },
        { status: 200, body: [POSTING] }
      ]);
      renderPage();
      const user = await openUploadPanel();

      await user.click(screen.getByRole('button', { name: /upload applied cv for senior pm/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent(/select the cv file you used/i);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('keeps the panel open and shows the error when the upload fails', async () => {
      mockFetchSequence([
        { status: 200, body: TITLES },
        { status: 200, body: [POSTING] },
        { status: 400, body: { message: 'Unsupported file format. Supported formats: docx, pdf, txt, md.' } }
      ]);
      renderPage();
      const user = userEvent.setup({ applyAccept: false });
      await screen.findByText('Senior PM');
      await user.selectOptions(screen.getByLabelText(/status for senior pm/i), 'Applied');

      await user.upload(
        screen.getByLabelText(/cv file used for senior pm/i),
        new File(['cv'], 'my-cv.pages', { type: 'application/octet-stream' })
      );
      await user.click(screen.getByRole('button', { name: /upload applied cv for senior pm/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Unsupported file format. Supported formats: docx, pdf, txt, md.'
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByLabelText(/status for senior pm/i)).toHaveValue('New');
    });

    it('warns that an existing applied CV will be replaced', async () => {
      mockFetchSequence([
        { status: 200, body: TITLES },
        { status: 200, body: [APPLIED] }
      ]);
      renderPage();
      await openUploadPanel();

      expect(screen.getByText(/this replaces the cv already on file \(my-cv\.docx\)/i)).toBeInTheDocument();
    });

    it('shows no applied-CV download link for a posting that was never applied to', async () => {
      mockFetchSequence([
        { status: 200, body: TITLES },
        { status: 200, body: [POSTING] }
      ]);
      renderPage();
      await screen.findByText('Senior PM');

      expect(screen.queryByRole('link', { name: /download applied cv/i })).not.toBeInTheDocument();
    });

    it('lets an Applied posting be moved to another status directly', async () => {
      const user = userEvent.setup();
      mockFetchSequence([
        { status: 200, body: TITLES },
        { status: 200, body: [APPLIED] },
        { status: 200, body: { ...APPLIED, status: 'Rejected' } }
      ]);
      renderPage();
      await screen.findByText('Senior PM');

      await user.selectOptions(screen.getByLabelText(/status for senior pm/i), 'Rejected');

      expect(await screen.findByDisplayValue('Rejected')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
