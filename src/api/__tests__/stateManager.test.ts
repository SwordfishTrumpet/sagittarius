/**
 * State Manager Tests
 *
 * Tests the JMAP state persistence layer (RFC 8620 §5.2 sinceState support).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSessionStorage: Record<string, string> = {};
const sessionStorageMock = {
  getItem: vi.fn((key: string) => mockSessionStorage[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { mockSessionStorage[key] = val; }),
  removeItem: vi.fn((key: string) => { delete mockSessionStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]); }),
  get length() { return Object.keys(mockSessionStorage).length; },
  key: vi.fn((i: number) => Object.keys(mockSessionStorage)[i] ?? null),
};

describe('StateManager', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]);
    vi.stubGlobal('sessionStorage', sessionStorageMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return null for unknown state types', async () => {
    const { stateManager } = await import('../stateManager');
    expect(stateManager.getState('Email')).toBeNull();
    expect(stateManager.getState('Mailbox')).toBeNull();
    expect(stateManager.getState('Thread')).toBeNull();
  });

  it('should persist and retrieve state', async () => {
    const { stateManager } = await import('../stateManager');

    stateManager.setState('Email', 'state-001');
    expect(stateManager.getState('Email')).toBe('state-001');

    stateManager.setState('Email', 'state-002');
    expect(stateManager.getState('Email')).toBe('state-002');
  });

  it('should persist to sessionStorage', async () => {
    const { stateManager } = await import('../stateManager');

    stateManager.setState('Email', 'state-001');
    stateManager.setState('Mailbox', 'state-mb');

    // Check that sessionStorage was called with the correct key
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
      'jmap_states',
      expect.any(String),
    );

    // Parse the stored value
    const stored = JSON.parse(mockSessionStorage['jmap_states']);
    expect(stored.Email).toBe('state-001');
    expect(stored.Mailbox).toBe('state-mb');

    stateManager.clearAll();
  });

  it('should clear all states', async () => {
    const { stateManager } = await import('../stateManager');

    stateManager.setState('Email', 'state-001');
    stateManager.setState('Mailbox', 'state-mb');
    stateManager.clearAll();

    expect(stateManager.getState('Email')).toBeNull();
    expect(stateManager.getState('Mailbox')).toBeNull();
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('jmap_states');
  });

  it('should restore state from sessionStorage on construction', async () => {
    // Pre-populate sessionStorage
    mockSessionStorage['jmap_states'] = JSON.stringify({
      Email: 'restored-email',
      Thread: 'restored-thread',
    });

    const { stateManager } = await import('../stateManager');

    expect(stateManager.getState('Email')).toBe('restored-email');
    expect(stateManager.getState('Thread')).toBe('restored-thread');

    stateManager.clearAll();
  });

  it('should handle corrupted sessionStorage gracefully', async () => {
    mockSessionStorage['jmap_states'] = 'not-valid-json{{';

    // Should not throw
    const { stateManager } = await import('../stateManager');
    expect(stateManager.getState('Email')).toBeNull();
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
