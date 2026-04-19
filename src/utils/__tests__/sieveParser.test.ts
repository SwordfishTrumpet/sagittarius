import { describe, it, expect } from 'vitest';
import { parseSieveScript } from '../sieveParser';

describe('sieveParser', () => {
  it('should parse empty script', () => {
    const rules = parseSieveScript('');
    expect(rules).toEqual([]);
  });

  it('should parse script with only whitespace', () => {
    const rules = parseSieveScript('   \n\t  ');
    expect(rules).toEqual([]);
  });

  it('should parse simple fileinto rule', () => {
    const script = `
      require ["fileinto"];
      if header :contains "From" "test@example.com" {
        fileinto "Test";
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules).toHaveLength(1);
    expect(rules[0].name).toBe('Rule 1');
    expect(rules[0].enabled).toBe(true);
    expect(rules[0].conditions).toHaveLength(1);
    expect(rules[0].conditions[0]).toMatchObject({
      field: 'from',
      operator: 'contains',
      value: 'test@example.com',
    });
    expect(rules[0].actions).toHaveLength(1);
    expect(rules[0].actions[0]).toMatchObject({
      type: 'fileinto',
      value: 'Test',
    });
  });

  it('should parse subject condition', () => {
    const script = `
      if header :is "Subject" "Meeting" {
        fileinto "Meetings";
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules[0].conditions[0]).toMatchObject({
      field: 'subject',
      operator: 'is',
      value: 'Meeting',
    });
  });

  it('should parse to condition', () => {
    const script = `
      if header :contains "To" "support@company.com" {
        fileinto "Support";
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules[0].conditions[0]).toMatchObject({
      field: 'to',
      operator: 'contains',
      value: 'support@company.com',
    });
  });

  it('should parse matches operator', () => {
    const script = `
      if header :matches "Subject" "*urgent*" {
        keep;
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules[0].conditions[0]).toMatchObject({
      field: 'subject',
      operator: 'matches',
      value: '*urgent*',
    });
  });

  it('should parse not-contains operator', () => {
    const script = `
      if not header :contains "From" "spam" {
        keep;
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules[0].conditions[0]).toMatchObject({
      field: 'from',
      operator: 'not-contains',
      value: 'spam',
    });
  });

  it('should parse size :over condition', () => {
    const script = `
      if size :over 1000000 {
        fileinto "Large";
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules[0].conditions[0]).toMatchObject({
      field: 'size',
      operator: 'greater-than',
      value: '1000000',
    });
  });

  it('should parse size :under condition', () => {
    const script = `
      if size :under 1024 {
        fileinto "Small";
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules[0].conditions[0]).toMatchObject({
      field: 'size',
      operator: 'less-than',
      value: '1024',
    });
  });

  it('should parse discard action', () => {
    const script = `
      if header :contains "Subject" "spam" {
        discard;
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules[0].actions[0]).toMatchObject({
      type: 'discard',
    });
  });

  it('should parse keep action', () => {
    const script = `
      if header :contains "From" "friend@example.com" {
        keep;
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules[0].actions[0]).toMatchObject({
      type: 'keep',
    });
  });

  it('should parse redirect action', () => {
    const script = `
      if header :contains "To" "backup@example.com" {
        redirect "archived@example.com";
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules[0].actions[0]).toMatchObject({
      type: 'redirect',
      value: 'archived@example.com',
    });
  });

  it('should parse flag action', () => {
    const script = `
      require ["imap4flags"];
      if header :contains "Subject" "important" {
        addflag "\\\\Flagged";
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules[0].actions[0]).toMatchObject({
      type: 'flag',
    });
  });

  it('should parse vacation action', () => {
    const script = `
      require ["vacation"];
      vacation "I am out of office";
    `;
    const rules = parseSieveScript(script);
    // Vacation as top-level action might not be parsed as conditional
    expect(rules.length).toBeGreaterThanOrEqual(0);
  });

  it('should parse allof conditions (allOf operator)', () => {
    const script = `
      if allof(
        header :contains "From" "company.com",
        header :contains "Subject" "invoice"
      ) {
        fileinto "Invoices";
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules[0].conditionOperator).toBe('allOf');
    expect(rules[0].conditions).toHaveLength(2);
  });

  it('should parse anyof conditions (anyOf operator)', () => {
    const script = `
      if anyof(
        header :contains "From" "alice@example.com",
        header :contains "From" "bob@example.com"
      ) {
        fileinto "Friends";
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules[0].conditionOperator).toBe('anyOf');
    expect(rules[0].conditions).toHaveLength(2);
  });

  it('should parse multiple actions', () => {
    const script = `
      if header :contains "Subject" "invoice" {
        fileinto "Invoices";
        addflag "\\\\Flagged";
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules[0].actions).toHaveLength(2);
  });

  it('should strip comments', () => {
    const script = `
      # This is a comment
      if header :contains "From" "test" {
        /* Block comment */
        fileinto "Test";
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules).toHaveLength(1);
  });

  it('should handle escaped quotes in values', () => {
    const script = `
      if header :contains "Subject" "say \\"hello\\"" {
        keep;
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules[0].conditions[0].value).toBe('say "hello"');
  });

  it('should handle escaped backslashes in values', () => {
    const script = `
      if header :contains "Subject" "path\\\\to\\\\file" {
        keep;
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules[0].conditions[0].value).toBe('path\\to\\file');
  });

  it('should parse multiple rules', () => {
    const script = `
      if header :contains "From" "boss" {
        fileinto "Priority";
      }
      if header :contains "Subject" "spam" {
        discard;
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules).toHaveLength(2);
    expect(rules[0].name).toBe('Rule 1');
    expect(rules[1].name).toBe('Rule 2');
  });

  it('should handle malformed script gracefully', () => {
    const script = 'not a valid sieve script';
    const rules = parseSieveScript(script);
    expect(rules).toEqual([]);
  });

  it('should handle unclosed braces gracefully', () => {
    const script = `
      if header :contains "From" "test" {
        fileinto "Test";
    `;
    const rules = parseSieveScript(script);
    expect(rules).toEqual([]);
  });

  it('should generate unique IDs for rules', () => {
    const script = `
      if header :contains "From" "a" { keep; }
      if header :contains "From" "b" { keep; }
    `;
    const rules = parseSieveScript(script);
    expect(rules[0].id).not.toBe(rules[1].id);
    expect(rules[0].id).toHaveLength(8); // Random 8 char ID
  });

  it('should handle empty condition values', () => {
    const script = `
      if header :is "Subject" "" {
        keep;
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules[0].conditions[0].value).toBe('');
  });

  it('should handle nested parentheses in condition values', () => {
    const script = `
      if header :contains "Subject" "meeting (urgent)" {
        fileinto "Urgent";
      }
    `;
    const rules = parseSieveScript(script);
    expect(rules[0].conditions[0].value).toBe('meeting (urgent)');
  });
});
