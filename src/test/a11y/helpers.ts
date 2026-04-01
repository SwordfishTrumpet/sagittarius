import type AxeCore from 'axe-core';
import { axe } from 'vitest-axe';

export async function checkA11y(container: HTMLElement): Promise<AxeCore.AxeResults> {
  return axe(container, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa'],
    },
    rules: {
      // jsdom does not implement canvas, which axe uses for contrast checks.
      'color-contrast': { enabled: false },
    },
  });
}
