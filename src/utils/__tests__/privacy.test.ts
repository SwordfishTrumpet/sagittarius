/**
 * Privacy Utility — Tests (migrated from console-based runner to Vitest)
 *
 * Tests external image blocking, unblocking, and counting.
 */

import { describe, it, expect } from 'vitest';
import {
  blockExternalImages,
  unblockExternalImages,
  countExternalImages,
  resolveCidImages,
  isInlineAttachment,
} from '../privacy';

describe('Privacy Utility — External Image Blocking', () => {
  describe('blockExternalImages', () => {
    it('should block a single external https image', () => {
      const html = '<img src="https://example.com/image.png" alt="test">';
      const result = blockExternalImages(html);
      expect(result.count).toBe(1);
      expect(result.modifiedHtml).toContain('data-blocked-src');
      // The original src should be moved to data-blocked-src, and the actual
      // src attribute should now be the placeholder SVG, not the external URL.
      // We can't use a naive substring check because data-blocked-src="https://..."
      // itself contains 'src="https://..."'. Instead, verify the src attribute
      // now points to a data: placeholder.
      expect(result.modifiedHtml).toMatch(/\bsrc="data:image\/svg\+xml/);
      expect(result.modifiedHtml).toContain('data-blocked-src="https://example.com/image.png"');
    });

    it('should block multiple external images', () => {
      const html = `
        <img src="https://example.com/image1.png" alt="test">
        <img src="http://example.com/image2.png" alt="test">
        <img src="//example.com/image3.png" alt="test">
      `;
      const result = blockExternalImages(html);
      expect(result.count).toBe(3);
    });

    it('should not block data:, blob:, local, or relative images', () => {
      const html = `
        <img src="https://example.com/remote.png" alt="external">
        <img src="data:image/png;base64,abc123" alt="data">
        <img src="blob:http://example.com/abc" alt="blob">
        <img src="/local/image.png" alt="local">
        <img src="./relative/image.png" alt="relative">
      `;
      const result = blockExternalImages(html);
      expect(result.count).toBe(1);
    });

    it('should handle HTML with no images', () => {
      const html = '<p>Just plain text</p>';
      const result = blockExternalImages(html);
      expect(result.count).toBe(0);
      expect(result.modifiedHtml).toContain('Just plain text');
    });
  });

  describe('unblockExternalImages', () => {
    it('should restore blocked images', () => {
      const html = '<img src="https://example.com/image.png">';
      const blocked = blockExternalImages(html);
      const unblocked = unblockExternalImages(blocked.modifiedHtml);
      expect(unblocked).toContain('https://example.com/image.png');
    });
  });

  describe('countExternalImages', () => {
    it('should count external images without modifying HTML', () => {
      const html = '<img src="https://example.com/img1.png"><img src="https://example.com/img2.png">';
      const count = countExternalImages(html);
      expect(count).toBe(2);
    });

    it('should return 0 for no external images', () => {
      expect(countExternalImages('<p>no images</p>')).toBe(0);
    });
  });

  describe('resolveCidImages', () => {
    it('should replace cid image sources with transparent placeholder and store URL in data-cid-src', () => {
      const html = '<p>Hello</p><img src="cid:inline-1">';
      const email = {
        attachments: [{ cid: 'inline-1', blobId: 'blob-1', type: 'image/png', name: 'image.png' }],
      };

      const resolved = resolveCidImages(html, email, (blobId, type, name) => `https://mail.test/${blobId}/${type}/${name}`);

      expect(resolved).toContain('src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"');
      expect(resolved).toContain('data-cid-src="https://mail.test/blob-1/image/png/image.png"');
    });

    it('should resolve cid images from bodyStructure subparts', () => {
      const html = '<img src="cid:body-inline">';
      const email = {
        bodyStructure: {
          type: 'multipart/related',
          subParts: [
            { cid: '<body-inline>', blobId: 'blob-2', type: 'image/jpeg', name: 'photo.jpg' },
          ],
        },
      };

      const resolved = resolveCidImages(html, email, (blobId) => `https://mail.test/${blobId}`);

      expect(resolved).toContain('src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"');
      expect(resolved).toContain('data-cid-src="https://mail.test/blob-2"');
    });

    it('should leave unknown cid references unchanged', () => {
      const html = '<img src="cid:missing">';
      const resolved = resolveCidImages(html, { attachments: [] }, () => 'https://mail.test/unused');
      expect(resolved).toBe(html);
    });
  });

  describe('isInlineAttachment', () => {
    it('should detect CID image attachments as inline', () => {
      expect(isInlineAttachment({ cid: 'inline-1', type: 'image/png' })).toBe(true);
    });

    it('should reject non-image or non-cid attachments', () => {
      expect(isInlineAttachment({ cid: 'inline-1', type: 'application/pdf' })).toBe(false);
      expect(isInlineAttachment({ type: 'image/png' })).toBe(false);
    });
  });
});
