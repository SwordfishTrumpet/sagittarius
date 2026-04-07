/**
 * Text Search Enhancement Utilities — Tests
 * 
 * Tests for CJK tokenization, English stemming, language detection,
 * and search query processing.
 */

import { describe, it, expect } from 'vitest';
import {
  detectLanguage,
  containsCJK,
  tokenizeCJK,
  tokenizeMixed,
  stemEnglish,
  stemWords,
  processSearchQuery,
  generateSearchSuggestions,
  prepareEmailContentForIndexing,
  calculateRelevanceScore,
  type ProcessedQuery,
} from '../textSearch';

describe('textSearch — Language Detection', () => {
  describe('detectLanguage', () => {
    it('should detect CJK text', () => {
      expect(detectLanguage('你好世界')).toBe('cjk');
      expect(detectLanguage('こんにちは')).toBe('cjk');
      expect(detectLanguage('안녕하세요')).toBe('cjk');
    });

    it('should detect Latin text', () => {
      expect(detectLanguage('hello world')).toBe('latin');
      expect(detectLanguage('café résumé')).toBe('latin');
    });

    it('should detect mixed CJK-Latin text', () => {
      expect(detectLanguage('hello世界')).toBe('cjk-latin');
      expect(detectLanguage('testテスト')).toBe('cjk-latin');
    });

    it('should detect Cyrillic text', () => {
      expect(detectLanguage('привет мир')).toBe('cyrillic');
    });

    it('should detect Arabic text', () => {
      expect(detectLanguage('مرحبا')).toBe('arabic');
    });

    it('should return unknown for empty or symbol-only text', () => {
      expect(detectLanguage('')).toBe('unknown');
      expect(detectLanguage('   ')).toBe('unknown');
      expect(detectLanguage('123 !@#')).toBe('unknown');
    });

    it('should detect mixed (3+ scripts) as mixed', () => {
      expect(detectLanguage('hello привет 你好')).toBe('mixed');
    });
  });

  describe('containsCJK', () => {
    it('should return true for CJK characters', () => {
      expect(containsCJK('你好')).toBe(true);
      expect(containsCJK('日本語')).toBe(true);
      expect(containsCJK('한국어')).toBe(true);
    });

    it('should return false for non-CJK text', () => {
      expect(containsCJK('hello')).toBe(false);
      expect(containsCJK('привет')).toBe(false);
      expect(containsCJK('123')).toBe(false);
    });

    it('should return true for mixed CJK-Latin', () => {
      expect(containsCJK('hello你好')).toBe(true);
    });
  });
});

describe('textSearch — CJK Tokenization', () => {
  describe('tokenizeCJK', () => {
    it('should tokenize Chinese text with bigrams by default', () => {
      const result = tokenizeCJK('你好世界');
      expect(result).toContain('你好');
      expect(result).toContain('好世');
      expect(result).toContain('世界');
    });

    it('should return single characters with nGramSize=1', () => {
      const result = tokenizeCJK('你好世界', 1);
      expect(result).toEqual(['你', '好', '世', '界']);
    });

    it('should return trigrams with nGramSize=3', () => {
      const result = tokenizeCJK('你好世界', 3);
      expect(result).toContain('你好世');
      expect(result).toContain('好世界');
    });

    it('should handle Japanese Hiragana', () => {
      const result = tokenizeCJK('こんにちは');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('こん');
      expect(result).toContain('んに');
    });

    it('should handle Japanese Katakana', () => {
      const result = tokenizeCJK('カタカナ');
      expect(result).toContain('カタ');
      expect(result).toContain('タカ');
    });

    it('should handle Korean Hangul', () => {
      const result = tokenizeCJK('안녕하세요');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should filter out non-CJK characters', () => {
      const result = tokenizeCJK('hello你好world');
      expect(result).not.toContain('h');
      expect(result).not.toContain('e');
      expect(result).toContain('你好');
    });

    it('should remove duplicate tokens', () => {
      const result = tokenizeCJK('你你好好');
      // Should deduplicate but keep order
      const unique = [...new Set(result)];
      expect(result.length).toBe(unique.length);
    });

    it('should return empty array for empty or non-CJK text', () => {
      expect(tokenizeCJK('')).toEqual([]);
      expect(tokenizeCJK('hello')).toEqual([]);
    });
  });

  describe('tokenizeMixed', () => {
    it('should separate CJK and Latin tokens', () => {
      const result = tokenizeMixed('hello你好world');
      expect(result.cjk.length).toBeGreaterThan(0);
      expect(result.latin).toContain('hello');
      expect(result.latin).toContain('world');
    });

    it('should handle pure Latin text', () => {
      const result = tokenizeMixed('hello world test');
      expect(result.cjk).toEqual([]);
      expect(result.latin).toEqual(['hello', 'world', 'test']);
    });

    it('should handle pure CJK text', () => {
      const result = tokenizeMixed('你好世界');
      expect(result.latin).toEqual([]);
      expect(result.cjk.length).toBeGreaterThan(0);
    });

    it('should normalize Latin tokens to lowercase', () => {
      const result = tokenizeMixed('HELLO World');
      expect(result.latin).toContain('hello');
      expect(result.latin).toContain('world');
    });

    it('should handle numbers and symbols', () => {
      const result = tokenizeMixed('test123你好!');
      expect(result.latin).toContain('test');
      expect(result.cjk).toContain('你好');
    });
  });
});

describe('textSearch — English Stemming', () => {
  describe('stemEnglish', () => {
    it('should stem plural -s', () => {
      expect(stemEnglish('books')).toBe('book');
      expect(stemEnglish('cats')).toBe('cat');
    });

    it('should stem -ies to -y', () => {
      // Porter stemmer: ies -> y (flies -> fly, cries -> cry)
      // Note: The test previously had inconsistent expectations for cries/cri
      expect(stemEnglish('flies')).toBe('fly');
      expect(stemEnglish('cries')).toBe('cry');
    });

    it('should stem -ing', () => {
      expect(stemEnglish('running')).toBe('run');
      expect(stemEnglish('jumping')).toBe('jump');
    });

    it('should stem -ed', () => {
      expect(stemEnglish('walked')).toBe('walk');
      expect(stemEnglish('played')).toBe('play');
    });

    it('should stem -ly', () => {
      // Porter stemmer: ly suffix removed, then other rules may apply
      expect(stemEnglish('quickly')).toBe('quick');
      expect(stemEnglish('slowly')).toBe('slow');
    });

    it('should stem complex suffixes', () => {
      // Porter stemmer results for these words
      // organization -> ization -> ize -> e removed by step 5a (m=3>1)
      expect(stemEnglish('organization')).toBe('organiz');
      // national = nation + al -> nation (al removed in step 4 with m>1)
      expect(stemEnglish('national')).toBe('nation');
      // effective = effect + ive -> effect (ive removed in step 4 with m>1)
      expect(stemEnglish('effective')).toBe('effect');
    });

    it('should handle -ness suffix', () => {
      expect(stemEnglish('happiness')).toBe('happi'); // stems to happiness root
    });

    it('should not stem short words', () => {
      expect(stemEnglish('is')).toBe('is');
      expect(stemEnglish('as')).toBe('as');
      expect(stemEnglish('be')).toBe('be');
    });

    it('should not stem excluded words', () => {
      expect(stemEnglish('this')).toBe('this');
      expect(stemEnglish('was')).toBe('was');
      expect(stemEnglish('has')).toBe('has');
      expect(stemEnglish('the')).toBe('the');
      expect(stemEnglish('and')).toBe('and');
    });

    it('should not stem words with apostrophes (possessives)', () => {
      // Current implementation doesn't handle apostrophes specially
      expect(stemEnglish("don't")).toBe("don't");
    });

    it('should convert to lowercase', () => {
      expect(stemEnglish('RUNNING')).toBe('run');
      expect(stemEnglish('Books')).toBe('book');
    });

    it('should return unchanged for non-Latin text', () => {
      expect(stemEnglish('你好')).toBe('你好');
    });

    it('should handle empty or short input', () => {
      expect(stemEnglish('')).toBe('');
      expect(stemEnglish('a')).toBe('a');
      expect(stemEnglish('ab')).toBe('ab');
    });
  });

  describe('stemWords', () => {
    it('should stem an array of words', () => {
      const result = stemWords(['running', 'flies', 'books']);
      expect(result).toEqual(['run', 'fly', 'book']);
    });

    it('should handle empty array', () => {
      expect(stemWords([])).toEqual([]);
    });

    it('should preserve order', () => {
      const input = ['first', 'second', 'third'];
      const result = stemWords(input);
      expect(result.length).toBe(input.length);
    });
  });
});

describe('textSearch — Query Processing', () => {
  describe('processSearchQuery', () => {
    it('should process English query with stemming', () => {
      const result = processSearchQuery('running books');
      expect(result.language).toBe('latin');
      expect(result.latinTokens).toContain('run');
      expect(result.latinTokens).toContain('book');
      expect(result.stemmingApplied).toBe(true);
    });

    it('should process CJK query with n-grams', () => {
      const result = processSearchQuery('你好世界');
      expect(result.language).toBe('cjk');
      expect(result.cjkTokens.length).toBeGreaterThan(0);
      expect(result.cjkTokens).toContain('你好');
    });

    it('should process mixed CJK-Latin query', () => {
      const result = processSearchQuery('hello你好world');
      expect(result.language).toBe('cjk-latin');
      expect(result.cjkTokens.length).toBeGreaterThan(0);
      expect(result.latinTokens).toContain('hello');
      expect(result.latinTokens).toContain('world');
    });

    it('should disable stemming when option is false', () => {
      const result = processSearchQuery('running', { enableStemming: false });
      expect(result.latinTokens).toContain('running');
      expect(result.stemmingApplied).toBe(false);
    });

    it('should respect cjkNGramSize option', () => {
      const bigrams = processSearchQuery('你好世界', { cjkNGramSize: 2 });
      const trigrams = processSearchQuery('你好世界', { cjkNGramSize: 3 });
      
      expect(bigrams.cjkTokens).toContain('你好');
      expect(bigrams.cjkTokens).toContain('好世');
      
      expect(trigrams.cjkTokens).toContain('你好世');
      expect(trigrams.cjkTokens).not.toContain('你好');
    });

    it('should return expanded terms combining CJK and Latin', () => {
      const result = processSearchQuery('running books 你好');
      expect(result.expandedTerms).toContain('run');
      expect(result.expandedTerms).toContain('book');
      expect(result.expandedTerms.some(t => containsCJK(t))).toBe(true);
    });

    it('should handle empty query', () => {
      const result = processSearchQuery('');
      expect(result.language).toBe('unknown');
      expect(result.expandedTerms).toEqual([]);
      expect(result.cjkTokens).toEqual([]);
      expect(result.latinTokens).toEqual([]);
    });

    it('should handle whitespace-only query', () => {
      const result = processSearchQuery('   ');
      expect(result.language).toBe('unknown');
      expect(result.expandedTerms).toEqual([]);
    });

    it('should trim whitespace from original query', () => {
      const result = processSearchQuery('  hello  ');
      expect(result.original).toBe('hello');
    });

    it('should deduplicate expanded terms', () => {
      const result = processSearchQuery('hello hello world');
      const uniqueTerms = [...new Set(result.expandedTerms)];
      expect(result.expandedTerms.length).toBe(uniqueTerms.length);
    });
  });

  describe('generateSearchSuggestions', () => {
    it('should return empty array for short input', () => {
      expect(generateSearchSuggestions('')).toEqual([]);
      expect(generateSearchSuggestions('a')).toEqual([]);
    });

    it('should include original query as first suggestion', () => {
      const result = generateSearchSuggestions('runni');
      expect(result[0]).toBe('runni');
    });

    it('should limit suggestions to maxSuggestions', () => {
      const result = generateSearchSuggestions('running', { maxSuggestions: 2 });
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should default to 5 max suggestions', () => {
      const result = generateSearchSuggestions('hello world test');
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should respect includeStemmed option', () => {
      const withStemmed = generateSearchSuggestions('running', { includeStemmed: true });
      const withoutStemmed = generateSearchSuggestions('running', { includeStemmed: false });
      
      // Without stemming, should have fewer or same suggestions
      expect(withoutStemmed.length).toBeLessThanOrEqual(withStemmed.length);
    });
  });
});

describe('textSearch — Email Indexing Helpers', () => {
  describe('prepareEmailContentForIndexing', () => {
    it('should extract searchable terms from email fields', () => {
      const result = prepareEmailContentForIndexing(
        'Meeting Notes',
        'Here are the running notes from our meeting',
        'alice@example.com',
        'bob@example.com'
      );
      
      expect(result.terms.length).toBeGreaterThan(0);
      expect(result.language).toBe('latin');
    });

    it('should handle CJK email content', () => {
      const result = prepareEmailContentForIndexing(
        '会議メモ',
        'これは会議の記録です',
        'alice@example.com'
      );
      
      expect(result.language).toBe('cjk-latin');
      expect(result.terms.length).toBeGreaterThan(0);
    });

    it('should make optional to field optional', () => {
      const result = prepareEmailContentForIndexing(
        'Subject',
        'Body content',
        'from@example.com'
      );
      
      expect(result.terms).toContain('subject');
      // "body" gets stemmed to "bodi" by Porter stemmer (y->i rule)
      expect(result.terms).toContain('bodi');
      expect(result.terms).toContain('from');
    });

    it('should process all fields for indexing', () => {
      const result = prepareEmailContentForIndexing(
        'Hello World',
        'This is a test',
        'sender@test.com',
        'recipient@test.com'
      );
      
      // Should contain stemmed/normalized versions
      expect(result.terms.length).toBeGreaterThan(0);
    });
  });

  describe('calculateRelevanceScore', () => {
    it('should return 0 for empty inputs', () => {
      expect(calculateRelevanceScore([], ['term'])).toBe(0);
      expect(calculateRelevanceScore(['term'], [])).toBe(0);
    });

    it('should score exact matches higher', () => {
      const score = calculateRelevanceScore(['hello'], ['hello', 'world']);
      expect(score).toBe(3); // exactMatch weight is 3
    });

    it('should score multiple matches', () => {
      const score = calculateRelevanceScore(['hello', 'world'], ['hello', 'world', 'test']);
      expect(score).toBe(6); // 2 exact matches * 3
    });

    it('should handle partial matches with lower weight', () => {
      const score = calculateRelevanceScore(['hello'], ['helloworld']);
      expect(score).toBe(1); // partialMatch weight is 1
    });

    it('should respect custom weights', () => {
      const score = calculateRelevanceScore(
        ['test'],
        ['test'],
        { exactMatch: 5, partialMatch: 2 }
      );
      expect(score).toBe(5);
    });

    it('should be case-insensitive', () => {
      const score = calculateRelevanceScore(['HELLO'], ['hello']);
      expect(score).toBe(3);
    });

    it('should not double-count', () => {
      const score = calculateRelevanceScore(['hello'], ['hello', 'hello']);
      // Should still count as one match since document terms are deduplicated
      expect(score).toBe(3);
    });
  });
});
