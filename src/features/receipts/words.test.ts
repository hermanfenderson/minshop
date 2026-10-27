import { describe, expect, it } from 'vitest';
import { amountInWords, englishWords, italianWords } from './words';

describe('italianWords', () => {
  it.each([
    [0, 'zero'],
    [1, 'uno'],
    [3, 'tre'],
    [11, 'undici'],
    [21, 'ventuno'],
    [23, 'ventitré'],
    [28, 'ventotto'],
    [40, 'quaranta'],
    [100, 'cento'],
    [103, 'centotré'],
    [108, 'centotto'],
    [180, 'centottanta'],
    [250, 'duecentocinquanta'],
    [1000, 'mille'],
    [1001, 'milleuno'],
    [2500, 'duemilacinquecento'],
    [10000, 'diecimila'],
    [21000, 'ventunomila'],
    [1_000_000, 'unmilione'],
    [2_000_003, 'duemilionitre'],
  ])('%i → %s', (n, words) => {
    expect(italianWords(n)).toBe(words);
  });
});

describe('englishWords', () => {
  it.each([
    [0, 'zero'],
    [15, 'fifteen'],
    [40, 'forty'],
    [42, 'forty-two'],
    [105, 'one hundred five'],
    [2500, 'two thousand five hundred'],
    [10000, 'ten thousand'],
    [1_000_001, 'one million one'],
  ])('%i → %s', (n, words) => {
    expect(englishWords(n)).toBe(words);
  });
});

describe('amountInWords', () => {
  it('writes the major units in words and the cents in figures', () => {
    expect(amountInWords(4000, 'EUR', 'it')).toBe('quaranta/00');
    expect(amountInWords(2750, 'EUR', 'it-IT')).toBe('ventisette/50');
    expect(amountInWords(4005, 'EUR', 'en')).toBe('forty/05');
  });

  it('follows the currency scale', () => {
    expect(amountInWords(1500, 'JPY', 'en')).toBe('one thousand five hundred');
    expect(amountInWords(1234, 'BHD', 'en')).toBe('one/234');
  });
});
