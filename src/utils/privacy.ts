/**
 * Privacy & Security Utilities
 * Handles external image blocking and CID inline image resolution
 */

export interface BlockedImageInfo {
  count: number;
  originalHtml: string;
  modifiedHtml: string;
}

/**
 * Parse a srcset attribute value and return individual candidate URLs.
 * srcset format: "url1 1x, url2 2x, url3 100w, url4 100w 200h"
 */
function parseSrcset(srcset: string): string[] {
  if (!srcset) return [];
  return srcset
    .split(',')
    .map(part => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

/**
 * Check if a srcset string contains any external URLs
 */
function containsExternalUrlInSrcset(srcset: string): boolean {
  return parseSrcset(srcset).some(url => isExternalImage(url));
}

/**
 * Check if an image source is external (not local or blob)
 * External images: http://, https://, protocol-relative //
 * Local/Safe: data:, blob:, relative paths, absolute paths
 */
function isExternalImage(src: string): boolean {
  if (!src) return false;
  
  // External URLs starting with http/https or protocol-relative
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
    return true;
  }
  
  // Non-external sources (safe)
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return false;
  }
  
  // Relative and absolute paths are safe (served from same origin)
  return false;
}

/**
 * Extract all image tags from HTML and identify external ones
 * Checks img[src], img[srcset], and source[srcset] inside picture
 */
function findExternalImages(html: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const found: string[] = [];

  const images = Array.from(doc.querySelectorAll('img'));
  images.forEach(img => {
    const src = img.getAttribute('src');
    if (src && isExternalImage(src)) {
      found.push(src);
    }
    const srcset = img.getAttribute('srcset');
    if (srcset) {
      parseSrcset(srcset).forEach(url => {
        if (isExternalImage(url)) found.push(url);
      });
    }
  });

  const sources = Array.from(doc.querySelectorAll('source'));
  sources.forEach(source => {
    const srcset = source.getAttribute('srcset');
    if (srcset) {
      parseSrcset(srcset).forEach(url => {
        if (isExternalImage(url)) found.push(url);
      });
    }
  });

  return found;
}

/**
 * Block external images by moving src to data-blocked-src
 * This prevents the browser from loading them immediately
 * Returns info about blocked images and the modified HTML
 */
export function blockExternalImages(html: string): BlockedImageInfo {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  let blockedCount = 0;

  const getPlaceholder = (width: string, height: string) => (
    `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'%3E%3Crect fill='%23F2F2F7' width='100%25' height='100%25' rx='8'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-size='11' fill='%238E8E93' font-family='system-ui'%3E🛡 Image blocked%3C/text%3E%3C/svg%3E`
  );

  const images = Array.from(doc.querySelectorAll('img'));
  images.forEach(img => {
    const src = img.getAttribute('src');
    const srcset = img.getAttribute('srcset');
    const hasExternalSrc = src && isExternalImage(src);
    const hasExternalSrcset = srcset && containsExternalUrlInSrcset(srcset);

    if (!hasExternalSrc && !hasExternalSrcset) return;

    blockedCount += 1;

    if (hasExternalSrc) {
      // Use explicit width/height attributes or fallback to default
      // (DOMParser context returns 0 for img.width/img.height since image isn't loaded)
      const explicitWidth = img.getAttribute('width');
      const explicitHeight = img.getAttribute('height');
      const width = explicitWidth || '120';
      const height = explicitHeight || '80';
      const style = img.getAttribute('style') || '';
      const stylePrefix = style && !style.trim().endsWith(';') ? `${style};` : style;

      img.setAttribute('data-blocked-src', src);
      img.setAttribute('src', getPlaceholder(width, height));
      img.setAttribute('style', `${stylePrefix}border:1px dashed var(--icloud-text-tertiary);border-radius:8px;`);
    } else {
      // Only srcset is external, not src — still need a placeholder
      const explicitWidth = img.getAttribute('width');
      const explicitHeight = img.getAttribute('height');
      const width = explicitWidth || '120';
      const height = explicitHeight || '80';
      const style = img.getAttribute('style') || '';
      const stylePrefix = style && !style.trim().endsWith(';') ? `${style};` : style;

      img.setAttribute('data-blocked-srcset', srcset ?? '');
      img.setAttribute('src', getPlaceholder(width, height));
      img.setAttribute('style', `${stylePrefix}border:1px dashed var(--icloud-text-tertiary);border-radius:8px;`);
    }

    if (hasExternalSrcset) {
      img.setAttribute('data-blocked-srcset', srcset || img.getAttribute('data-blocked-srcset') || '');
      img.removeAttribute('srcset');
    }
  });

  // Block <source srcset> inside <picture> elements
  const sources = Array.from(doc.querySelectorAll('source'));
  sources.forEach(source => {
    const srcset = source.getAttribute('srcset');
    if (!srcset || !containsExternalUrlInSrcset(srcset)) return;

    blockedCount += 1;
    source.setAttribute('data-blocked-srcset', srcset);
    source.removeAttribute('srcset');
  });

  const styledElements = Array.from(doc.querySelectorAll<HTMLElement>('[style]'));
  styledElements.forEach(el => {
    const style = el.getAttribute('style') || '';
    // Match http://, https://, and protocol-relative URLs (//example.com)
    if (!/url\s*\(\s*['"]?(?:https?:|\/\/)/i.test(style)) return;

    const blocked = style.replace(
      /url\s*\(\s*['"]?((?:https?:)?\/\/[^'")\s]+)['"]?\s*\)/gi,
      'url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7)',
    );

    if (blocked !== style) {
      blockedCount += 1
      el.setAttribute('data-blocked-style', style);
      el.setAttribute('style', blocked);
    }
  });

  return {
    count: blockedCount,
    originalHtml: html,
    modifiedHtml: doc.body.innerHTML,
  };
}

/**
 * Unblock external images by restoring src from data-blocked-src
 */
export function unblockExternalImages(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Restore blocked images (src was replaced with placeholder)
  const images = Array.from(doc.querySelectorAll('img[data-blocked-src]'));
  images.forEach(img => {
    const blockedSrc = img.getAttribute('data-blocked-src');
    if (blockedSrc) {
      img.setAttribute('src', blockedSrc);
      img.removeAttribute('data-blocked-src');
      // Remove the dashed border we added
      const style = img.getAttribute('style') || '';
      img.setAttribute('style', style.replace(/;?border:1px dashed var\(--icloud-text-tertiary\);border-radius:8px;?/g, ''));
    }
  });

  // Restore blocked images (srcset was cleared)
  const srcsetImages = Array.from(doc.querySelectorAll('img[data-blocked-srcset]'));
  srcsetImages.forEach(img => {
    const blockedSrcset = img.getAttribute('data-blocked-srcset');
    if (blockedSrcset) {
      img.setAttribute('srcset', blockedSrcset);
      img.removeAttribute('data-blocked-srcset');
      // If src was also replaced (no data-blocked-src, but placeholder was set),
      // restore it only if we have a saved src via data-blocked-src
      // srcset-only case: clear the placeholder src too
      if (!img.hasAttribute('data-blocked-src') && img.getAttribute('src')?.startsWith('data:image/svg+xml')) {
        img.removeAttribute('src');
      }
    }
  });

  // Restore blocked <source> srcset attributes
  const sources = Array.from(doc.querySelectorAll('source[data-blocked-srcset]'));
  sources.forEach(source => {
    const blockedSrcset = source.getAttribute('data-blocked-srcset');
    if (blockedSrcset) {
      source.setAttribute('srcset', blockedSrcset);
      source.removeAttribute('data-blocked-srcset');
    }
  });

  // Restore blocked CSS background images
  const styledElements = Array.from(doc.querySelectorAll('[data-blocked-style]'));
  styledElements.forEach(el => {
    const original = el.getAttribute('data-blocked-style');
    if (original) {
      el.setAttribute('style', original);
      el.removeAttribute('data-blocked-style');
    }
  });
  
  return doc.body.innerHTML;
}

/**
 * Count external images without modifying the HTML
 * Useful for determining if banner should be shown
 */
export function countExternalImages(html: string): number {
  return findExternalImages(html).length;
}

import type { EmailBodyPart } from '../types/jmap';

/**
 * Resolve CID (Content-ID) image references in HTML to blob download URLs.
 *
 * Email HTML references inline images as `<img src="cid:content-id">`.
 * JMAP attachments include a `cid` field (without angle brackets) and a `blobId`.
 * This function replaces cid: URLs with the JMAP blob download URL so the browser
 * can fetch them. The download URL is marked with a data attribute so a post-render
 * effect can fetch with auth headers and swap in a blob: URL.
 *
 * SECURITY: This function uses DOM parsing instead of regex to prevent XSS
 * via malformed HTML. It should be called AFTER DOMPurify sanitization.
 */
export function resolveCidImages(
  html: string,
  email: { attachments?: EmailBodyPart[]; bodyStructure?: EmailBodyPart | null },
  getBlobUrl: (blobId: string, type: string, name: string) => string,
): string {
  if (!html) return html;

  // Build a map of Content-ID → { blobId, type, name }
  // Check both attachments and bodyStructure (inline images may only appear in the latter)
  const cidMap = new Map<string, { blobId: string; type: string; name: string }>();

  const addToCidMap = (part: EmailBodyPart | undefined | null) => {
    if (!part) return;
    if (part.cid && part.blobId) {
      const cid = part.cid.replace(/^<|>$/g, '');
      cidMap.set(cid, { blobId: part.blobId, type: part.type || 'application/octet-stream', name: part.name || 'image' });
    }
    // Recurse into multipart sub-parts
    if (part.subParts) {
      for (const sub of part.subParts) addToCidMap(sub);
    }
  };

  if (email.attachments) {
    for (const att of email.attachments) addToCidMap(att);
  }
  if (email.bodyStructure) {
    addToCidMap(email.bodyStructure);
  }

  if (cidMap.size === 0) return html;

  // SECURITY FIX (VULN-002): Use DOM parsing instead of regex to prevent XSS
  // via malformed HTML. Regex-based replacement on raw HTML could be bypassed.
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Process images using DOM API instead of regex.
  // Store the download URL in data-cid-src and use a transparent placeholder
  // for src. This prevents the browser from making an unauthenticated request
  // (which would 401) before the iframe hydration code can fetch with auth.
  const TRANSPARENT_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const images = doc.querySelectorAll('img[src^="cid:"]');
  images.forEach(img => {
    const src = img.getAttribute('src');
    if (!src) return;
    const cid = src.replace(/^cid:/, '').replace(/^<|>$/g, '');
    const info = cidMap.get(cid);
    if (info) {
      const url = getBlobUrl(info.blobId, info.type, info.name);
      img.setAttribute('src', TRANSPARENT_PLACEHOLDER);
      img.setAttribute('data-cid-src', url);
    }
  });

  return doc.body.innerHTML;
}

/**
 * Check if an attachment is an inline CID image (should not appear in attachment list).
 */
export function isInlineAttachment(attachment: EmailBodyPart): boolean {
  return !!attachment.cid && attachment.type?.startsWith('image/');
}
