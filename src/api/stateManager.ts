type JMAPStateType = 'Email' | 'Mailbox' | 'Thread' | string;

class StateManager {
  private states: Map<JMAPStateType, string>;

  constructor() {
    this.states = new Map();
  }

  getState(type: JMAPStateType): string | null {
    return this.states.get(type) ?? null;
  }

  setState(type: JMAPStateType, state: string): void {
    this.states.set(type, state);
  }

  clearAll(): void {
    this.states.clear();
  }
}

export const stateManager = new StateManager();
