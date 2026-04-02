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
 */
function findExternalImages(html: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const images = Array.from(doc.querySelectorAll('img'));
  
  return images
    .map(img => img.getAttribute('src'))
    .filter((src): src is string => src !== null && isExternalImage(src));
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
    if (!src || !isExternalImage(src)) return;

    blockedCount += 1;

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
    img.setAttribute('style', `${stylePrefix}border:1px dashed #C7C7CC;border-radius:8px;`);
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
  
  // Restore blocked images
  const images = Array.from(doc.querySelectorAll('img[data-blocked-src]'));
  images.forEach(img => {
    const blockedSrc = img.getAttribute('data-blocked-src');
    if (blockedSrc) {
      img.setAttribute('src', blockedSrc);
      img.removeAttribute('data-blocked-src');
      // Remove the dashed border we added
      const style = img.getAttribute('style') || '';
      img.setAttribute('style', style.replace(/;?border:1px dashed #C7C7CC;border-radius:8px;?/g, ''));
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

/**
 * Resolve CID (Content-ID) image references in HTML to blob download URLs.
 * 
 * Email HTML references inline images as `<img src="cid:content-id">`.
 * JMAP attachments include a `cid` field (without angle brackets) and a `blobId`.
 * This function replaces cid: URLs with the JMAP blob download URL so the browser
 * can fetch them. The download URL is marked with a data attribute so a post-render
 * effect can fetch with auth headers and swap in a blob: URL.
 *
 * MUST be called BEFORE DOMPurify, since DOMPurify strips the cid: protocol.
 */
export function resolveCidImages(
  html: string,
  email: { attachments?: any[]; bodyStructure?: any },
  getBlobUrl: (blobId: string, type: string, name: string) => string,
): string {
  if (!html) return html;

  // Build a map of Content-ID → { blobId, type, name }
  // Check both attachments and bodyStructure (inline images may only appear in the latter)
  const cidMap = new Map<string, { blobId: string; type: string; name: string }>();
  
  const addToCidMap = (part: any) => {
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

  // Replace cid: references in img src attributes.
  // Use regex to work on the raw HTML string (before DOM parsing) so DOMPurify
  // never sees cid: protocol. Also handles edge cases like quoted/unquoted src.
  return html.replace(
    /(<img\b[^>]*?\bsrc\s*=\s*)(["'])cid:([^"'\s>]+)\2/gi,
    (match, prefix, quote, cidValue) => {
      const cleanCid = cidValue.replace(/^<|>$/g, '');
      const info = cidMap.get(cleanCid);
      if (!info) return match; // Unknown CID — leave as-is
      const url = getBlobUrl(info.blobId, info.type, info.name);
      // Mark with data-cid-src so post-render auth fetch can find it
      return `${prefix}${quote}${url}${quote} data-cid-src="${cleanCid}"`;
    },
  );
}

/**
 * Check if an attachment is an inline CID image (should not appear in attachment list).
 */
export function isInlineAttachment(attachment: any): boolean {
  return !!attachment.cid && attachment.type?.startsWith('image/');
}
