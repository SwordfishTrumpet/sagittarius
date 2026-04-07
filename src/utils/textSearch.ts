/**
 * Full-Text Search Enhancement Utilities
 * 
 * Provides CJK (Chinese, Japanese, Korean) tokenization and stemming support
 * for improved search accuracy across different languages.
 * 
 * Features:
 * - CJK character tokenization (handles languages without word boundaries)
 * - English stemming using Porter Stemmer algorithm
 * - Search query expansion for better matches
 * - Language detection for query processing
 */

// ============================================================================
// Language Detection
// ============================================================================

/** Regex patterns for different language categories */
const LANGUAGE_PATTERNS = {
  /** CJK Unified Ideographs, Hiragana, Katakana, Hangul */
  cjk: /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/,
  /** Arabic script */
  arabic: /[\u0600-\u06FF\u0750-\u077F]/,
  /** Cyrillic script (Russian, Ukrainian, etc.) */
  cyrillic: /[\u0400-\u04FF]/,
  /** Hebrew script */
  hebrew: /[\u0590-\u05FF]/,
  /** Greek script */
  greek: /[\u0370-\u03FF]/,
  /** Latin script (English, European languages) */
  latin: /[a-zA-Z\u00C0-\u024F]/,
} as const;

/**
 * Detect the primary language category of text
 * Returns 'cjk' | 'arabic' | 'cyrillic' | 'hebrew' | 'greek' | 'latin' | 'mixed'
 */
export function detectLanguage(text: string): string {
  const detected = new Set<string>();
  
  for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
    if (pattern.test(text)) {
      detected.add(lang);
    }
  }
  
  if (detected.size === 0) return 'unknown';
  if (detected.size === 1) return Array.from(detected)[0];
  
  // Check for CJK + Latin (common in mixed content)
  if (detected.has('cjk') && detected.has('latin') && detected.size === 2) {
    return 'cjk-latin';
  }
  
  return 'mixed';
}

/**
 * Check if text contains CJK characters
 */
export function containsCJK(text: string): boolean {
  return LANGUAGE_PATTERNS.cjk.test(text);
}

// ============================================================================
// CJK Tokenization
// ============================================================================

/**
 * Tokenize CJK text using character-based approach with n-gram support.
 * 
 * Since CJK languages don't use spaces between words, we use:
 * 1. Character-based tokenization for single characters
 * 2. N-gram tokenization for better context (bigrams/trigrams)
 * 
 * @param text - The text to tokenize
 * @param nGramSize - Size of n-grams (default: 2 for bigrams, 1 for single chars)
 * @returns Array of tokens
 */
export function tokenizeCJK(text: string, nGramSize: 1 | 2 | 3 = 2): string[] {
  if (!text) return [];
  
  // Extract only CJK characters
  const cjkChars = text.split('').filter(char => LANGUAGE_PATTERNS.cjk.test(char));
  
  if (cjkChars.length === 0) return [];
  
  const tokens: string[] = [];
  
  if (nGramSize === 1) {
    // Single character tokens
    return [...new Set(cjkChars)];
  }
  
  // Generate n-grams
  for (let i = 0; i <= cjkChars.length - nGramSize; i++) {
    const ngram = cjkChars.slice(i, i + nGramSize).join('');
    tokens.push(ngram);
  }
  
  // Remove duplicates while preserving order
  return [...new Set(tokens)];
}

/**
 * Smart tokenization that handles mixed CJK-Latin text
 * Splits by language boundaries and tokenizes each part appropriately
 * 
 * @param text - The text to tokenize
 * @param cjkNGramSize - Size of CJK n-grams (default: 2)
 */
export function tokenizeMixed(text: string, cjkNGramSize: 1 | 2 | 3 = 2): { cjk: string[]; latin: string[] } {
  const cjkTokens: string[] = [];
  const latinTokens: string[] = [];
  
  if (!text) return { cjk: [], latin: [] };
  
  // Split text into segments by language type
  const segments: { type: 'cjk' | 'latin' | 'other'; content: string }[] = [];
  let currentSegment: { type: 'cjk' | 'latin' | 'other'; content: string } = { type: 'other', content: '' };
  
  for (const char of text) {
    let charType: 'cjk' | 'latin' | 'other' = 'other';
    
    if (LANGUAGE_PATTERNS.cjk.test(char)) {
      charType = 'cjk';
    } else if (LANGUAGE_PATTERNS.latin.test(char)) {
      charType = 'latin';
    }
    
    // If segment is empty, set its type to current char type and add char
    if (currentSegment.content === '') {
      currentSegment.type = charType;
      currentSegment.content = char;
    } else if (charType !== currentSegment.type) {
      // Type changed, save current segment and start new one
      segments.push(currentSegment);
      currentSegment = { type: charType, content: char };
    } else {
      // Same type, append char
      currentSegment.content += char;
    }
  }
  
  if (currentSegment.content) {
    segments.push(currentSegment);
  }
  
  // Tokenize each segment
  for (const segment of segments) {
    if (segment.type === 'cjk') {
      cjkTokens.push(...tokenizeCJK(segment.content, cjkNGramSize));
    } else if (segment.type === 'latin') {
      // For Latin text, split by whitespace and normalize
      const words = segment.content
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 0);
      latinTokens.push(...words);
    }
  }
  
  return { cjk: [...new Set(cjkTokens)], latin: [...new Set(latinTokens)] };
}

// ============================================================================
// English Stemming (Porter Stemmer Algorithm - Simplified)
// ============================================================================

/**
 * Check if a character is a vowel
 */
function isVowel(char: string): boolean {
  return 'aeiou'.includes(char.toLowerCase());
}

/**
 * Count the number of vowel-consonant sequences in a word (m measure).
 * This is used by Porter stemmer to determine if a suffix can be removed.
 * e.g., "trouble" -> VC sequence count = 1 (tr-ouble)
 * e.g., "oaten" -> VC sequence count = 2 (oa-ten)
 */
function measure(word: string): number {
  let count = 0;
  let i = 0;
  
  // Skip initial consonants
  while (i < word.length && !isVowel(word[i])) {
    i++;
  }
  
  // Count VC sequences
  while (i < word.length) {
    // Skip vowels
    while (i < word.length && isVowel(word[i])) {
      i++;
    }
    if (i >= word.length) break;
    
    // Found consonant after vowels = 1 VC
    count++;
    
    // Skip consonants
    while (i < word.length && !isVowel(word[i])) {
      i++;
    }
  }
  
  return count;
}

/**
 * Check if stem ends with double consonant (e.g., "tt", "ll", "ss")
 */
function endsWithDoubleConsonant(stem: string): boolean {
  if (stem.length < 2) return false;
  const last = stem[stem.length - 1];
  const secondLast = stem[stem.length - 2];
  return last === secondLast && !isVowel(last);
}

/**
 * Check if stem ends with CVC pattern (consonant-vowel-consonant)
 * where the final consonant is not w, x, or y
 */
function endsWithCVC(stem: string): boolean {
  if (stem.length < 3) return false;
  const last = stem[stem.length - 1];
  const middle = stem[stem.length - 2];
  const first = stem[stem.length - 3];
  
  return !isVowel(first) && isVowel(middle) && !isVowel(last) && !'wxy'.includes(last);
}

/** Words that should not be stemmed */
const EXCLUDED_WORDS = new Set([
  'is', 'as', 'us', 'this', 'was', 'has', 'does', 'goes', 'yes',
  'be', 'he', 'me', 'she', 'we', 'the', 'a', 'an', 'and', 'or',
  'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
]);

/**
 * Stem an English word to its root form using simplified Porter algorithm.
 * Implements steps 1a, 1b, 2, and 3 of the Porter stemmer with some simplifications.
 * 
 * This handles common suffixes to improve search recall.
 * 
 * Examples:
 * - "running" -> "run"
 * - "flies" -> "fly"
 * - "organization" -> "organize"
 * - "books" -> "book"
 * 
 * @param word - The word to stem
 * @returns The stemmed word
 */
export function stemEnglish(word: string): string {
  if (!word || word.length <= 2) return word;
  
  const lowerWord = word.toLowerCase();
  
  // Don't stem excluded words
  if (EXCLUDED_WORDS.has(lowerWord)) return lowerWord;
  
  // Don't stem if word contains non-ASCII (not Latin script)
  for (const char of lowerWord) {
    const code = char.charCodeAt(0);
    // Allow a-z and common Latin extensions
    if (!((code >= 97 && code <= 122) || (code >= 224 && code <= 591))) {
      return lowerWord;
    }
  }
  
  let stem = lowerWord;
  
  // ===== Step 1a: Handle plurals =====
  // SSES -> SS (caresses -> caress)
  if (stem.endsWith('sses')) {
    stem = stem.slice(0, -2);
  }
  // IES -> Y (flies -> fly, cries -> cry) - special case for search
  else if (stem.endsWith('ies')) {
    stem = stem.slice(0, -3) + 'y';  // ies -> y (not i)
    return stem;  // Skip y->i rule for ies words
  }
  // SS -> SS (stress -> stress) - no change
  else if (stem.endsWith('ss')) {
    // no change
  }
  // S -> (cats -> cat)
  else if (stem.endsWith('s') && stem.length > 3) {
    const candidate = stem.slice(0, -1);
    // Only remove 's' if there's a vowel before it (not 'ss' words)
    if (candidate.length >= 3) {
      stem = candidate;
    }
  }
  
  // ===== Step 1b: Handle -ed and -ing =====
  let step1bApplied = false;
  
  // EED -> EE (agreed -> agree, feed -> feed)
  if (stem.endsWith('eed')) {
    if (measure(stem.slice(0, -3)) > 0) {
      stem = stem.slice(0, -1); // keep the ee
    }
  }
  // ED -> (plastered -> plaster, bled -> bled)
  else if (stem.endsWith('ed')) {
    const candidate = stem.slice(0, -2);
    // Only if stem contains a vowel
    if (candidate.split('').some(isVowel)) {
      stem = candidate;
      step1bApplied = true;
    }
  }
  // ING -> (motoring -> motor, sing -> sing, running -> run)
  else if (stem.endsWith('ing')) {
    const candidate = stem.slice(0, -3);
    // Only if stem contains a vowel
    if (candidate.split('').some(isVowel)) {
      stem = candidate;
      step1bApplied = true;
    }
  }
  
  // Post-step 1b cleanup: restore 'e' or remove doubled consonant
  if (step1bApplied) {
    // If ends with AT/BL/IZ -> add E (ration -> rate, conspiration -> conspirate)
    if (/at$|bl$|iz$/.test(stem)) {
      stem += 'e';
    }
    // If ends with double consonant and not ending in L
    else if (endsWithDoubleConsonant(stem)) {
      const lastChar = stem[stem.length - 1];
      // Remove one consonant for non-L (running -> runn -> run after e-restoration)
      if (lastChar !== 'l' && lastChar !== 's') {
        stem = stem.slice(0, -1);
      }
    }
    // If m=1 and ends with CVC -> add E
    else if (measure(stem) === 1 && endsWithCVC(stem)) {
      stem += 'e';
    }
    // Special case: running should become run (restore 'e' after removing 'ing' from words ending in 'n')
    if (stem.endsWith('nn')) {
      stem = stem.slice(0, -2) + 'n';
    }
  }
  
  // ===== Step 1c: Handle 'y' -> 'i' =====
  // Y -> I (happy -> happi, cry -> cri)
  // But NOT for words ending in 'ly' - those are handled separately
  if (stem.endsWith('y') && stem.length > 2 && !word.endsWith('ly')) {
    const beforeY = stem[stem.length - 2];
    // Only if there's a consonant before the y
    if (!isVowel(beforeY)) {
      stem = stem.slice(0, -1) + 'i';
    }
  }
  
  // ===== Step 2: Handle longer suffixes (m > 0) =====
  // Ordered: longest suffixes first to ensure correct matching
  const step2Patterns = [
    // Longest suffixes first
    { suffix: 'iveness', replacement: 'ive' },
    { suffix: 'fulness', replacement: 'ful' },
    { suffix: 'ization', replacement: 'ize' },  // organization -> organize (before ational)
    { suffix: 'isation', replacement: 'ise' },
    { suffix: 'ousness', replacement: 'ous' },
    { suffix: 'ational', replacement: 'ate' },
    { suffix: 'tional', replacement: 'tion' },
    { suffix: 'biliti', replacement: 'ble' },
    { suffix: 'ation', replacement: 'ate' },
    { suffix: 'ator', replacement: 'ate' },
    { suffix: 'alism', replacement: 'al' },
    { suffix: 'aliti', replacement: 'al' },
    { suffix: 'iviti', replacement: 'ive' },
    { suffix: 'alli', replacement: 'al' },
    { suffix: 'anci', replacement: 'ance' },
    { suffix: 'enci', replacement: 'ence' },
    { suffix: 'entli', replacement: 'ent' },
    { suffix: 'eli', replacement: 'e' },
    { suffix: 'izer', replacement: 'ize' },
    { suffix: 'abli', replacement: 'able' },
    { suffix: 'ousli', replacement: 'ous' },
  ];
  
  for (const { suffix, replacement } of step2Patterns) {
    if (stem.endsWith(suffix)) {
      const candidate = stem.slice(0, -suffix.length);
      if (measure(candidate) > 0) {
        stem = candidate + replacement;
        break; // Only apply first matching rule
      }
    }
  }
  
  // ===== Step 3: More suffixes (m > 0) =====
  const step3Patterns = [
    { suffix: 'icate', replacement: 'ic' },
    { suffix: 'ative', replacement: '' },
    { suffix: 'alize', replacement: 'al' },
    { suffix: 'alise', replacement: 'al' },
    { suffix: 'iciti', replacement: 'ic' },
    { suffix: 'ical', replacement: 'ic' },
    { suffix: 'ful', replacement: '' },
    { suffix: 'ness', replacement: '' },
    { suffix: 'ly', replacement: '' },  // quickly -> quick
  ];
  
  for (const { suffix, replacement } of step3Patterns) {
    if (stem.endsWith(suffix)) {
      const candidate = stem.slice(0, -suffix.length);
      if (measure(candidate) > 0) {
        stem = candidate + replacement;
        break;
      }
    }
  }
  
  // ===== Step 4: Remove suffixes with m > 1 =====
  // Note: 'ize' is NOT included here as it changes meaning too much (organize vs organ)
  const step4Patterns = [
    'al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement',
    'ment', 'ent', 'ion', 'ou', 'ism', 'ate', 'iti', 'ous', 'ive',
  ];
  
  for (const suffix of step4Patterns) {
    if (stem.endsWith(suffix)) {
      const candidate = stem.slice(0, -suffix.length);
      // Special case: ion requires s or t before it
      if (suffix === 'ion' && !/[st]$/.test(candidate)) {
        continue;
      }
      if (measure(candidate) > 1) {
        stem = candidate;
        break;
      }
    }
  }
  
  // ===== Step 5a: Remove final 'e' (m > 1, or m=1 and not cvc) =====
  if (stem.endsWith('e')) {
    const candidate = stem.slice(0, -1);
    const m = measure(candidate);
    if (m > 1) {
      stem = candidate;
    } else if (m === 1 && !endsWithCVC(candidate)) {
      stem = candidate;
    }
  }
  
  // ===== Step 5b: Remove doubled 'l' at end (m > 1) =====
  if (stem.endsWith('ll') && measure(stem) > 1) {
    stem = stem.slice(0, -1);
  }
  
  return stem;
}

/**
 * Stem an array of English words
 */
export function stemWords(words: string[]): string[] {
  return words.map(stemEnglish);
}

// ============================================================================
// Search Query Processing
// ============================================================================

export interface ProcessedQuery {
  /** Original query text */
  original: string;
  /** Detected language category */
  language: string;
  /** Tokenized terms for CJK content */
  cjkTokens: string[];
  /** Tokenized and stemmed terms for Latin content */
  latinTokens: string[];
  /** All unique search terms (expanded) */
  expandedTerms: string[];
  /** Whether stemming was applied */
  stemmingApplied: boolean;
}

/**
 * Process a search query for full-text search.
 * 
 * This function:
 * 1. Detects the language of the query
 * 2. Tokenizes CJK content with n-grams
 * 3. Stems English words
 * 4. Returns expanded search terms for better recall
 * 
 * @param query - The raw search query
 * @param options - Processing options
 * @returns Processed query with expanded terms
 */
export function processSearchQuery(
  query: string,
  options: { enableStemming?: boolean; cjkNGramSize?: 1 | 2 | 3 } = {}
): ProcessedQuery {
  const { enableStemming = true, cjkNGramSize = 2 } = options;
  
  if (!query || query.trim().length === 0) {
    return {
      original: query || '',
      language: 'unknown',
      cjkTokens: [],
      latinTokens: [],
      expandedTerms: [],
      stemmingApplied: false,
    };
  }
  
  const trimmedQuery = query.trim();
  const language = detectLanguage(trimmedQuery);
  const { cjk, latin } = tokenizeMixed(trimmedQuery, cjkNGramSize);
  
  // Apply stemming to Latin tokens if enabled
  const processedLatin = enableStemming ? stemWords(latin) : latin.map(w => w.toLowerCase());
  
  // CJK tokens are already n-grammed from tokenizeMixed
  const cjkNGrams = cjk;
  
  // Combine all unique terms
  const expandedTerms = [...new Set([...cjkNGrams, ...processedLatin])];
  
  return {
    original: trimmedQuery,
    language,
    cjkTokens: cjkNGrams,
    latinTokens: processedLatin,
    expandedTerms,
    stemmingApplied: enableStemming && processedLatin.length > 0,
  };
}

/**
 * Generate search suggestions based on a partial query.
 * Useful for autocomplete functionality.
 */
export function generateSearchSuggestions(
  partialQuery: string,
  options: { maxSuggestions?: number; includeStemmed?: boolean } = {}
): string[] {
  const { maxSuggestions = 5, includeStemmed = true } = options;
  
  if (!partialQuery || partialQuery.trim().length < 2) {
    return [];
  }
  
  const processed = processSearchQuery(partialQuery, { enableStemming: includeStemmed });
  const suggestions: string[] = [];
  
  // Add original query
  suggestions.push(partialQuery.trim());
  
  // Add expanded terms as suggestions
  for (const term of processed.expandedTerms.slice(0, maxSuggestions - 1)) {
    if (term !== partialQuery.trim() && !suggestions.includes(term)) {
      suggestions.push(term);
    }
  }
  
  return suggestions.slice(0, maxSuggestions);
}

// ============================================================================
// Email Content Indexing Helpers
// ============================================================================

/**
 * Prepare email content for indexing by extracting searchable terms.
 * This normalizes and tokenizes email content for better search matching.
 */
export function prepareEmailContentForIndexing(
  subject: string,
  body: string,
  from: string,
  to?: string
): { terms: string[]; language: string } {
  // Combine all searchable content
  const combined = [subject, body, from, to || ''].join(' ');
  
  const processed = processSearchQuery(combined, {
    enableStemming: true,
    cjkNGramSize: 2,
  });
  
  return {
    terms: processed.expandedTerms,
    language: processed.language,
  };
}

/**
 * Calculate search relevance score between query and document.
 * Higher score = better match.
 */
export function calculateRelevanceScore(
  queryTerms: string[],
  documentTerms: string[],
  weights: { exactMatch?: number; partialMatch?: number } = {}
): number {
  const { exactMatch = 3, partialMatch = 1 } = weights;
  
  if (queryTerms.length === 0 || documentTerms.length === 0) {
    return 0;
  }
  
  const docTermSet = new Set(documentTerms.map(t => t.toLowerCase()));
  let score = 0;
  
  for (const queryTerm of queryTerms) {
    const lowerQuery = queryTerm.toLowerCase();
    
    if (docTermSet.has(lowerQuery)) {
      score += exactMatch;
    } else {
      // Check for partial match (substring)
      for (const docTerm of docTermSet) {
        if (docTerm.includes(lowerQuery) || lowerQuery.includes(docTerm)) {
          score += partialMatch;
          break;
        }
      }
    }
  }
  
  return score;
}
