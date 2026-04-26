// UI tests for LoginPageComponent — registration success / emailSent behaviour
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ─────────── Module mocks ────────────────────────────────────────────────────

// Mock CSS import so jsdom doesn't choke on it
vi.mock('@/app/login/LoginPage.css', () => ({}));

// Mock next-intl so components using useTranslations work without a provider
vi.mock('next-intl', async () => {
  const { default: en } = await import('../../../locales/en.json');
  return {
    useTranslations: (namespace: string) => {
      return (key: string, params?: Record<string, string | number>) => {
        const ns = (en as unknown as Record<string, Record<string, string>>)[namespace] ?? {};
        let value: string = ns[key] ?? key;
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            value = value.replace(`{${k}}`, String(v));
          }
        }
        return value;
      };
    },
  };
});

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock useAuth (not used when props are provided, but must be importable)
vi.mock('@/lib/client/hooks/useAuth', () => ({
  useAuth: () => ({ login: vi.fn(), register: vi.fn() }),
}));

// ─────────── Component under test ────────────────────────────────────────────
import { LoginPageComponent } from '@/components/LoginPageComponent';

// ─────────── Helpers ─────────────────────────────────────────────────────────

function renderSignUp(
  onRegister: (
    username: string,
    password: string,
    email?: string,
  ) => Promise<{ success: boolean; error?: string; emailSent?: boolean }>,
) {
  render(
    <LoginPageComponent
      onLogin={async () => ({ success: false })}
      onRegister={onRegister}
    />,
  );

  // Switch to Sign Up tab (first occurrence; footer also has a "Sign Up" link)
  fireEvent.click(screen.getAllByText('Sign Up')[0]);
}

async function fillAndSubmitSignUp(email?: string) {
  fireEvent.change(screen.getByLabelText(/username/i), {
    target: { value: 'newuser' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'password123' },
  });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: 'password123' },
  });
  if (email) {
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: email },
    });
  }
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
  });
}

// ─────────── Tests ────────────────────────────────────────────────────────────

describe('LoginPageComponent — registration emailSent behaviour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore real timers in case a test switched to fake timers
    vi.useRealTimers();
  });

  it('emailSent_true_showsVerificationMessageBeforeRedirect', async () => {
    // Real timers: setTimeout fires in background but test checks state
    // right after submit (well within the 3-second window)
    const onRegister = vi.fn().mockResolvedValue({ success: true, emailSent: true });
    renderSignUp(onRegister);
    await fillAndSubmitSignUp('test@example.com');

    // act() above has flushed all pending React state updates;
    // the success message should be in the DOM immediately.
    expect(screen.getByText(/check your email/i)).toBeDefined();

    // The delayed redirect (3 s) should NOT have fired yet
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('emailSent_true_redirectsAfterDelay', async () => {
    vi.useFakeTimers(); // only this test needs timer control

    const onRegister = vi.fn().mockResolvedValue({ success: true, emailSent: true });
    renderSignUp(onRegister);

    // fillAndSubmitSignUp uses act() internally; with fake timers we need to
    // drain microtasks (Promises) via advanceTimersByTimeAsync(0)
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'newuser' } });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      // Drain the resolved promise + React state updates
      await vi.advanceTimersByTimeAsync(0);
    });

    // Message should be visible
    expect(screen.getByText(/check your email/i)).toBeDefined();
    // Not redirected yet
    expect(mockPush).not.toHaveBeenCalled();

    // Advance past the 3-second delay
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(mockPush).toHaveBeenCalledWith('/game');
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('emailSent_false_redirectsImmediatelyWithoutMessage', async () => {
    const onRegister = vi.fn().mockResolvedValue({ success: true, emailSent: false });
    renderSignUp(onRegister);
    await fillAndSubmitSignUp();

    // No verification message
    expect(screen.queryByText(/check your email/i)).toBeNull();

    // Router should have redirected immediately
    expect(mockPush).toHaveBeenCalledWith('/game');
  });

  it('emailSent_undefined_redirectsImmediatelyWithoutMessage', async () => {
    const onRegister = vi.fn().mockResolvedValue({ success: true });
    renderSignUp(onRegister);
    await fillAndSubmitSignUp();

    expect(screen.queryByText(/check your email/i)).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/game');
  });

  it('registrationError_showsErrorAndNoRedirect', async () => {
    const onRegister = vi.fn().mockResolvedValue({ success: false, error: 'Username taken' });
    renderSignUp(onRegister);
    await fillAndSubmitSignUp();

    expect(screen.getByText('Username taken')).toBeDefined();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('LoginPageComponent — query-param banners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifiedParam_true_showsVerifiedBanner', () => {
    render(
      <LoginPageComponent
        onLogin={async () => ({ success: false })}
        onRegister={async () => ({ success: false })}
        verifiedParam="true"
      />,
    );
    expect(screen.getByText(/email verified/i)).toBeDefined();
  });

  it('errorParam_invalidToken_showsErrorBanner', () => {
    render(
      <LoginPageComponent
        onLogin={async () => ({ success: false })}
        onRegister={async () => ({ success: false })}
        errorParam="invalid-token"
      />,
    );
    expect(screen.getByText(/invalid or has expired/i)).toBeDefined();
  });

  it('resetParam_true_showsPasswordResetBanner', () => {
    render(
      <LoginPageComponent
        onLogin={async () => ({ success: false })}
        onRegister={async () => ({ success: false })}
        resetParam="true"
      />,
    );
    expect(screen.getByText(/password updated/i)).toBeDefined();
  });
});

describe('LoginPageComponent — forgot-password flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forgotPassword_linkVisible_onSignInTab', () => {
    render(
      <LoginPageComponent
        onLogin={async () => ({ success: false })}
        onRegister={async () => ({ success: false })}
      />,
    );
    expect(screen.getByRole('button', { name: /forgot password/i })).toBeDefined();
  });

  it('forgotPassword_linkNotVisible_onSignUpTab', () => {
    render(
      <LoginPageComponent
        onLogin={async () => ({ success: false })}
        onRegister={async () => ({ success: false })}
      />,
    );
    // Switch to Sign Up
    fireEvent.click(screen.getAllByText('Sign Up')[0]);
    expect(screen.queryByRole('button', { name: /forgot password/i })).toBeNull();
  });

  it('forgotPassword_clickShowsResetForm', () => {
    render(
      <LoginPageComponent
        onLogin={async () => ({ success: false })}
        onRegister={async () => ({ success: false })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    expect(screen.getByLabelText(/email address/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeDefined();
  });

  it('forgotPassword_submitCallsHandler', async () => {
    const onForgotPassword = vi.fn().mockResolvedValue({ success: true });
    render(
      <LoginPageComponent
        onLogin={async () => ({ success: false })}
        onRegister={async () => ({ success: false })}
        onForgotPassword={onForgotPassword}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'user@example.com' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    });
    expect(onForgotPassword).toHaveBeenCalledWith('user@example.com');
    expect(screen.getByText(/if that email is registered/i)).toBeDefined();
  });

  it('forgotPassword_backToSignIn_restoresLoginForm', () => {
    render(
      <LoginPageComponent
        onLogin={async () => ({ success: false })}
        onRegister={async () => ({ success: false })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }));
    // Login form should be restored
    expect(screen.getByLabelText(/^username/i)).toBeDefined();
    // Both the tab and submit button say "Sign In" — verify by checking the auth-form submit
    const signInButtons = screen.getAllByRole('button', { name: /^sign in$/i });
    expect(signInButtons.length).toBeGreaterThanOrEqual(1);
  });
});

