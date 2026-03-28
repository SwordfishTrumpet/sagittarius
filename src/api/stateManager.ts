const STORAGE_KEY = 'jmap_states';

type JMAPStateType = 'Email' | 'Mailbox' | 'Thread' | string;

class StateManager {
  private states: Map<JMAPStateType, string>;

  constructor() {
    this.states = new Map();
    this.load();
  }

  private load(): void {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Record<string, string> = JSON.parse(raw);
        for (const [type, state] of Object.entries(parsed)) {
          this.states.set(type, state);
        }
      }
    } catch {
      // Ignore parse errors — start fresh
      this.states.clear();
    }
  }

  private persist(): void {
    try {
      const obj: Record<string, string> = {};
      this.states.forEach((state, type) => {
        obj[type] = state;
      });
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // sessionStorage unavailable (private browsing quota, etc.) — no-op
    }
  }

  getState(type: JMAPStateType): string | null {
    return this.states.get(type) ?? null;
  }

  setState(type: JMAPStateType, state: string): void {
    this.states.set(type, state);
    this.persist();
  }

  clearAll(): void {
    this.states.clear();
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // no-op
    }
  }
}

export const stateManager = new StateManager();
