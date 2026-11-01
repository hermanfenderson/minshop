import { describe, expect, it } from 'vitest';
import { statementSuffix } from './statementDescriptor';

describe('statementSuffix', () => {
  it('uppercases and drops what card statements cannot show', () => {
    expect(statementSuffix("L'Altracittà")).toBe('LALTRACITTA');
    expect(statementSuffix('  festival   2027 ')).toBe('FESTIVAL 2027');
    expect(statementSuffix('a<b>"c"*\\d')).toBe('ABCD');
  });
  it('needs a letter and stays within 22 characters', () => {
    expect(statementSuffix('2027')).toBeNull();
    expect(statementSuffix('')).toBeNull();
    expect(statementSuffix(null)).toBeNull();
    expect(statementSuffix('x'.repeat(30))).toHaveLength(22);
  });
});
