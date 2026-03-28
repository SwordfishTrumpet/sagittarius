export interface SieveRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: SieveCondition[];
  conditionOperator: 'allOf' | 'anyOf';
  actions: SieveAction[];
}

export interface SieveCondition {
  field: 'from' | 'to' | 'subject' | 'header' | 'size';
  operator: 'contains' | 'is' | 'matches' | 'not-contains' | 'greater-than' | 'less-than';
  value: string;
}

export interface SieveAction {
  type: 'fileinto' | 'redirect' | 'discard' | 'keep' | 'flag' | 'vacation';
  value?: string;
}
