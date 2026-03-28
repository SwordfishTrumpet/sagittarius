/**
 * Test file for privacy.ts utility
 * Tests external image blocking functionality
 */

import {
  blockExternalImages,
  unblockExternalImages,
  countExternalImages,
} from './privacy';

// Test cases
const testCases = [
  {
    name: 'Single external image (https)',
    html: '<img src="https://example.com/image.png" alt="test">',
    expectedBlocked: 1,
  },
  {
    name: 'Multiple external images',
    html: `
      <img src="https://example.com/image1.png" alt="test">
      <img src="http://example.com/image2.png" alt="test">
      <img src="//example.com/image3.png" alt="test">
    `,
    expectedBlocked: 3,
  },
  {
    name: 'Mixed internal and external',
    html: `
      <img src="https://example.com/remote.png" alt="external">
      <img src="data:image/png;base64,abc123" alt="data">
      <img src="blob:http://example.com/abc" alt="blob">
      <img src="/local/image.png" alt="local">
      <img src="./relative/image.png" alt="relative">
    `,
    expectedBlocked: 1,
  },
  {
    name: 'No images',
    html: '<p>Just plain text</p>',
    expectedBlocked: 0,
  },
];

console.log('🧪 Privacy Utility Tests\n');

testCases.forEach((testCase) => {
  console.log(`Test: ${testCase.name}`);

  // Test blocking
  const blocked = blockExternalImages(testCase.html);
  const count = countExternalImages(testCase.html);

  if (blocked.count === testCase.expectedBlocked && count === testCase.expectedBlocked) {
    console.log(`  ✅ PASS - Blocked ${blocked.count} image(s)\n`);
  } else {
    console.log(
      `  ❌ FAIL - Expected ${testCase.expectedBlocked}, got ${blocked.count}\n`
    );
  }

  // Test that blocked images have data-blocked-src
  if (blocked.count > 0) {
    const hasBlockedSrc = blocked.modifiedHtml.includes('data-blocked-src');
    console.log(`  - Modified HTML has data-blocked-src: ${hasBlockedSrc ? '✅' : '❌'}\n`);

    // Test unblocking
    const unblocked = unblockExternalImages(blocked.modifiedHtml);
    const hasOriginalSrc = unblocked.includes('https://') || unblocked.includes('http://');
    console.log(`  - Unblocked HTML restored src: ${hasOriginalSrc ? '✅' : '❌'}\n`);
  }
});

console.log('✨ All tests completed!');
