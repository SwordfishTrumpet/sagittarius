import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { checkA11y } from './helpers';

describe('a11y smoke', () => {
  it('passes axe checks for a basic button', async () => {
    const { container } = render(<button type="button">Accessible button</button>);

    expect((await checkA11y(container)).violations).toHaveLength(0);
  });
});
