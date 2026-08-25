import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from './SettingsPage';

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

const NO_TEMPLATE = { status: 200, body: { hasTemplate: false, originalName: null, format: null } };

describe('SettingsPage', () => {
  it('shows that no key is configured initially', async () => {
    mockFetchSequence([{ status: 200, body: { hasKey: false, maskedKey: null } }, NO_TEMPLATE]);
    render(<SettingsPage />);
    expect(await screen.findByText(/no api key configured/i)).toBeInTheDocument();
  });

  it('shows the masked key once one is saved', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: { hasKey: false, maskedKey: null } },
      NO_TEMPLATE,
      { status: 200, body: { hasKey: true, maskedKey: '••••mnop' } }
    ]);
    render(<SettingsPage />);
    await screen.findByText(/no api key configured/i);

    await user.type(screen.getByLabelText(/openai api key/i), 'sk-abcdefghijklmnop');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/••••mnop/)).toBeInTheDocument();
  });

  it('shows a validation error when saving the key fails', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: { hasKey: false, maskedKey: null } },
      NO_TEMPLATE,
      { status: 400, body: { message: 'That does not look like a valid OpenAI API key' } }
    ]);
    render(<SettingsPage />);
    await screen.findByText(/no api key configured/i);

    await user.type(screen.getByLabelText(/openai api key/i), 'nope');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That does not look like a valid OpenAI API key'
    );
  });

  it('shows an error when the initial key status fetch fails', async () => {
    mockFetchSequence([{ status: 500, body: { message: 'Failed to load API key status' } }, NO_TEMPLATE]);
    render(<SettingsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load API key status');
  });

  it('shows that no resume template is configured initially', async () => {
    mockFetchSequence([{ status: 200, body: { hasKey: false, maskedKey: null } }, NO_TEMPLATE]);
    render(<SettingsPage />);
    expect(await screen.findByText(/no resume template configured/i)).toBeInTheDocument();
  });

  it('shows an error when the initial template status fetch fails', async () => {
    mockFetchSequence([
      { status: 200, body: { hasKey: false, maskedKey: null } },
      { status: 500, body: { message: 'Failed to load resume template status' } }
    ]);
    render(<SettingsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load resume template status');
  });

  it('shows the uploaded template once saved', async () => {
    const user = userEvent.setup();
    mockFetchSequence([
      { status: 200, body: { hasKey: false, maskedKey: null } },
      NO_TEMPLATE,
      { status: 200, body: { hasTemplate: true, originalName: 'resume.docx', format: 'docx' } }
    ]);
    render(<SettingsPage />);
    await screen.findByText(/no resume template configured/i);

    const file = new File(['dummy content'], 'resume.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    await user.upload(screen.getByLabelText(/resume template file/i), file);
    await user.click(screen.getByRole('button', { name: /upload/i }));

    expect(await screen.findByText(/resume\.docx/)).toBeInTheDocument();
  });

  it('shows a validation error when the template upload fails', async () => {
    const user = userEvent.setup({ applyAccept: false });
    mockFetchSequence([
      { status: 200, body: { hasKey: false, maskedKey: null } },
      NO_TEMPLATE,
      { status: 400, body: { message: 'Unsupported file format. Supported formats: docx, pdf, txt, md.' } }
    ]);
    render(<SettingsPage />);
    await screen.findByText(/no resume template configured/i);

    const file = new File(['dummy'], 'resume.pages');
    await user.upload(screen.getByLabelText(/resume template file/i), file);
    await user.click(screen.getByRole('button', { name: /upload/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/unsupported file format/i);
  });
});
