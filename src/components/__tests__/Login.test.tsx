import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Login } from '../Login';
import { jmapClient } from '../../api/jmap';
import { ServerIdentityChangedError } from '../../utils/serverFingerprint';
import { ServerUnreachableError, AuthError } from '../../utils/jmapErrors';
import { recordFailedAttempt, getRateLimitStatus } from '../../utils/rateLimit';

// Mock dependencies
vi.mock('../../api/jmap', () => ({
  jmapClient: {
    authenticate: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('../../utils/rateLimit', () => {
  const checkRateLimit = vi.fn();
  const recordFailedAttempt = vi.fn();
  const resetRateLimit = vi.fn();
  const getRateLimitStatus = vi.fn(() => ({ isLocked: false, remainingAttempts: 5, lockoutSeconds: null }));
  return { checkRateLimit, recordFailedAttempt, resetRateLimit, getRateLimitStatus };
});

describe('Login', () => {
  const mockOnLoginSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // The fingerprint endpoint answers fast (404) so the host probe never
    // hangs; individual tests override this for host-display coverage.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should render login form', () => {
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);
    expect(screen.getByText('Sagittarius')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your mail account')).toBeInTheDocument();
    expect(screen.getByLabelText('Email or username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should update username input', () => {
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);
    const usernameInput = screen.getByLabelText('Email or username');
    fireEvent.change(usernameInput, { target: { value: 'test@example.com' } });
    expect(usernameInput).toHaveValue('test@example.com');
  });

  it('should update password input', () => {
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);
    const passwordInput = screen.getByLabelText('Password');
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    expect(passwordInput).toHaveValue('password123');
  });

  it('should call authenticate on submit', async () => {
    const mockSession = {
      apiUrl: 'https://mail.example.com/jmap/',
      downloadUrl: 'https://mail.example.com/jmap/download/{accountId}/{blobId}/{name}',
      uploadUrl: 'https://mail.example.com/jmap/upload/{accountId}/',
      capabilities: {},
      primaryAccounts: {},
      accounts: {},
    };
    vi.mocked(jmapClient.authenticate).mockResolvedValueOnce(mockSession);
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    fireEvent.change(screen.getByLabelText('Email or username'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(jmapClient.authenticate).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('should call onLoginSuccess on successful login', async () => {
    const mockSession = {
      apiUrl: 'https://mail.example.com/jmap/',
      downloadUrl: 'https://mail.example.com/jmap/download/{accountId}/{blobId}/{name}',
      uploadUrl: 'https://mail.example.com/jmap/upload/{accountId}/',
      capabilities: {},
      primaryAccounts: {},
      accounts: {},
    };
    vi.mocked(jmapClient.authenticate).mockResolvedValueOnce(mockSession);
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    fireEvent.change(screen.getByLabelText('Email or username'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockOnLoginSuccess).toHaveBeenCalled();
    });
  });

  it('should show loading state during authentication', async () => {
    vi.mocked(jmapClient.authenticate).mockImplementation(() => new Promise(() => {}));
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    fireEvent.change(screen.getByLabelText('Email or username'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should require both fields', () => {
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);
    const usernameInput = screen.getByLabelText('Email or username');
    const passwordInput = screen.getByLabelText('Password');
    expect(usernameInput).toHaveAttribute('required');
    expect(passwordInput).toHaveAttribute('required');
  });

  it('shows the boot notice when the backend identity changed since the last session', () => {
    render(<Login onLoginSuccess={mockOnLoginSuccess} identityChangedNotice />);
    expect(screen.getByText(/mail server's identity changed/i)).toBeInTheDocument();
  });

  it('asks for explicit confirmation when the stored fingerprint differs and cancels cleanly', async () => {
    const err = new ServerIdentityChangedError(
      { host: 'old.example.com', scheme: 'https', resolved: true, addresses: [], certFingerprint: 'sha256:old', trusted: false, error: null },
      { host: 'new.example.com', scheme: 'https', resolved: true, addresses: [], certFingerprint: 'sha256:new', trusted: false, error: null },
    );
    vi.mocked(jmapClient.authenticate).mockRejectedValueOnce(err);
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    fireEvent.change(screen.getByLabelText('Email or username'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/The mail server identity has changed/i)).toBeInTheDocument();
    });
    expect(screen.getByText('old.example.com')).toBeInTheDocument();
    expect(screen.getByText('new.example.com')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText(/The mail server identity has changed/i)).not.toBeInTheDocument();
    });
    // Credentials were never sent without confirmation
    expect(jmapClient.authenticate).toHaveBeenCalledTimes(1);
  });

  it('only sends credentials after the user confirms the identity change', async () => {
    const err = new ServerIdentityChangedError(
      { host: 'old.example.com', scheme: 'https', resolved: true, addresses: [], certFingerprint: 'sha256:old', trusted: false, error: null },
      { host: 'new.example.com', scheme: 'https', resolved: true, addresses: [], certFingerprint: 'sha256:new', trusted: false, error: null },
    );
    const mockSession = {
      apiUrl: 'https://mail.example.com/jmap/',
      downloadUrl: 'https://mail.example.com/jmap/download/{accountId}/{blobId}/{name}',
      uploadUrl: 'https://mail.example.com/jmap/upload/{accountId}/',
      capabilities: {},
      primaryAccounts: {},
      accounts: {},
    };
    vi.mocked(jmapClient.authenticate)
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce(mockSession);
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    fireEvent.change(screen.getByLabelText('Email or username'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/The mail server identity has changed/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /continue sign-in/i }));

    await waitFor(() => {
      expect(jmapClient.authenticate).toHaveBeenCalledWith('test@example.com', 'password123', { confirmIdentityChange: true });
    });
    expect(mockOnLoginSuccess).toHaveBeenCalled();
  });

  it('shows a server-unreachable message and never counts it against the rate limiter', async () => {
    vi.mocked(jmapClient.authenticate).mockRejectedValueOnce(new ServerUnreachableError('Server unreachable'));
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    fireEvent.change(screen.getByLabelText('Email or username'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/Mail server unreachable/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Failed to authenticate/i)).not.toBeInTheDocument();
    expect(recordFailedAttempt).not.toHaveBeenCalled();
  });

  it('still counts genuine auth failures against the rate limiter', async () => {
    vi.mocked(jmapClient.authenticate).mockRejectedValueOnce(new AuthError('Authentication failed'));
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    fireEvent.change(screen.getByLabelText('Email or username'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/Failed to authenticate/i)).toBeInTheDocument();
    });
    expect(recordFailedAttempt).toHaveBeenCalledTimes(1);
  });

  it('does not count protocol errors against the rate limiter', async () => {
    vi.mocked(jmapClient.authenticate).mockRejectedValueOnce(new Error('JMAP request failed: 500'));
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    fireEvent.change(screen.getByLabelText('Email or username'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Login failed. Please try again.')).toBeInTheDocument();
    });
    expect(recordFailedAttempt).not.toHaveBeenCalled();
  });

  it('never triggers lockout after repeated server-unreachable failures', async () => {
    vi.mocked(jmapClient.authenticate).mockRejectedValue(new ServerUnreachableError('Server unreachable'));
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    for (let i = 0; i < 5; i++) {
      fireEvent.change(screen.getByLabelText('Email or username'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      await waitFor(() => {
        expect(screen.getByText(/Mail server unreachable/i)).toBeInTheDocument();
      });
    }

    expect(recordFailedAttempt).not.toHaveBeenCalled();
    expect(getRateLimitStatus().isLocked).toBe(false);
    expect(screen.queryByText(/Account temporarily locked/i)).not.toBeInTheDocument();
  });

  it('displays the configured backend hostname on the login card', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/server-fingerprint') {
        return new Response(JSON.stringify({
          host: 'mail.example.com',
          scheme: 'https',
          resolved: true,
          addresses: [],
          certFingerprint: 'sha256:abc',
          trusted: false,
          error: null,
        }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }));
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    expect(await screen.findByText('mail.example.com')).toBeInTheDocument();
    expect(screen.getByText(/Signing in to/i)).toBeInTheDocument();
  });

  it('includes the configured host in the server-unreachable message', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/server-fingerprint') {
        return new Response(JSON.stringify({
          host: 'dead.example.com',
          scheme: 'https',
          resolved: false,
          addresses: [],
          certFingerprint: null,
          trusted: false,
          error: 'DNS resolution failed',
        }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }));
    vi.mocked(jmapClient.authenticate).mockRejectedValueOnce(new ServerUnreachableError('Server unreachable'));
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    // Wait for the host probe to resolve before submitting so the message
    // includes the configured host.
    await screen.findByText('dead.example.com')
    fireEvent.change(screen.getByLabelText('Email or username'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/Mail server unreachable \(dead\.example\.com\)/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/check your credentials/i)).not.toBeInTheDocument();
    expect(recordFailedAttempt).not.toHaveBeenCalled();
  });
});
