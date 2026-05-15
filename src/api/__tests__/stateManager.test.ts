/**
 * State Manager Tests
 *
 * Tests the JMAP state persistence layer (RFC 8620 §5.2 sinceState support).
 */

import { describe, it, expect } from 'vitest';

describe('StateManager', () => {
  it('should return null for unknown state types', async () => {
    const { stateManager } = await import('../stateManager');
    expect(stateManager.getState('Email')).toBeNull();
    expect(stateManager.getState('Mailbox')).toBeNull();
    expect(stateManager.getState('Thread')).toBeNull();
  });

  it('should store and retrieve state in memory', async () => {
    const { stateManager } = await import('../stateManager');

    stateManager.setState('Email', 'state-001');
    expect(stateManager.getState('Email')).toBe('state-001');

    stateManager.setState('Email', 'state-002');
    expect(stateManager.getState('Email')).toBe('state-002');
  });

  it('should clear all states', async () => {
    const { stateManager } = await import('../stateManager');

    stateManager.setState('Email', 'state-001');
    stateManager.setState('Mailbox', 'state-mb');
    stateManager.clearAll();

    expect(stateManager.getState('Email')).toBeNull();
    expect(stateManager.getState('Mailbox')).toBeNull();
  });

  it('should start with empty state on fresh import', async () => {
    const { stateManager } = await import('../stateManager');
    expect(stateManager.getState('Email')).toBeNull();
    expect(stateManager.getState('Mailbox')).toBeNull();
    expect(stateManager.getState('Thread')).toBeNull();
  });

  it('should support arbitrary state type names', async () => {
    const { stateManager } = await import('../stateManager');

    stateManager.setState('SieveScript', 'sieve-state-1');
    expect(stateManager.getState('SieveScript')).toBe('sieve-state-1');

    stateManager.setState('VacationResponse', 'vr-state-1');
    expect(stateManager.getState('VacationResponse')).toBe('vr-state-1');

    stateManager.clearAll();
  });
});
