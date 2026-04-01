import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Login } from '../../components/Login';
import { checkA11y } from './helpers';

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

describe('Login accessibility', () => {
  it('has no axe violations and supports keyboard-only submission', async () => {
    const user = userEvent.setup();
    const onLoginSuccess = vi.fn();
    const { container } = render(<Login onLoginSuccess={onLoginSuccess} />);

    expect((await checkA11y(container)).violations).toHaveLength(0);

    await user.tab();
    expect(document.activeElement).toHaveAttribute('id', 'login-username');

    await user.tab();
    expect(document.activeElement).toHaveAttribute('id', 'login-password');

    await user.keyboard('[Enter]');
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });
});
