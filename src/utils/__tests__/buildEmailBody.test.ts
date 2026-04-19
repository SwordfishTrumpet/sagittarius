import { describe, it, expect } from 'vitest';
import { buildEmailBody } from '../buildEmailBody';

describe('buildEmailBody', () => {
  it('should build plain text body', () => {
    const result = buildEmailBody('Hello world');
    expect(result.bodyValues).toEqual({
      'body-1': { value: 'Hello world', isTruncated: false },
    });
    expect(result.textBody).toEqual([{ partId: 'body-1', type: 'text/plain' }]);
    expect(result.htmlBody).toBeUndefined();
    expect(result.bodyStructure).toBeUndefined();
  });

  it('should build HTML body', () => {
    const result = buildEmailBody('<p>Hello world</p>');
    expect(result.bodyValues).toEqual({
      'body-1': { value: '<p>Hello world</p>', isTruncated: false },
    });
    expect(result.htmlBody).toEqual([{ partId: 'body-1', type: 'text/html' }]);
    expect(result.textBody).toBeUndefined();
  });

  it('should detect HTML by angle brackets', () => {
    const result = buildEmailBody('Text with <br> tag');
    expect(result.htmlBody).toBeDefined();
    expect(result.textBody).toBeUndefined();
  });

  it('should include attachments in multipart body structure', () => {
    const attachments = [
      { blobId: 'blob-1', name: 'file.pdf', type: 'application/pdf', size: 1234 },
    ];
    const result = buildEmailBody('Hello', attachments);
    expect(result.bodyStructure).toEqual({
      type: 'multipart/mixed',
      subParts: [
        { partId: 'body-1', type: 'text/plain' },
        { blobId: 'blob-1', type: 'application/pdf', name: 'file.pdf', disposition: 'attachment' },
      ],
    });
  });

  it('should handle multiple attachments', () => {
    const attachments = [
      { blobId: 'blob-1', name: 'file1.pdf', type: 'application/pdf', size: 1234 },
      { blobId: 'blob-2', name: 'file2.jpg', type: 'image/jpeg', size: 5678 },
    ];
    const result = buildEmailBody('Hello', attachments);
    expect(result.bodyStructure?.subParts).toHaveLength(3);
  });

  it('should not include textBody/htmlBody when attachments present', () => {
    const attachments = [{ blobId: 'blob-1', name: 'file.pdf', type: 'application/pdf', size: 1234 }];
    const result = buildEmailBody('Hello', attachments);
    expect(result.textBody).toBeUndefined();
    expect(result.htmlBody).toBeUndefined();
  });

  it('should null textBody/htmlBody when updating draft with attachments', () => {
    const attachments = [{ blobId: 'blob-1', name: 'file.pdf', type: 'application/pdf', size: 1234 }];
    const result = buildEmailBody('Hello', attachments, 'draft-1');
    expect(result.textBody).toBeNull();
    expect(result.htmlBody).toBeNull();
  });

  it('should null bodyStructure when updating draft without attachments', () => {
    const result = buildEmailBody('Hello', undefined, 'draft-1');
    expect(result.bodyStructure).toBeNull();
  });

  it('should null opposite body type when updating draft with HTML', () => {
    const result = buildEmailBody('<p>Hello</p>', undefined, 'draft-1');
    expect(result.htmlBody).toEqual([{ partId: 'body-1', type: 'text/html' }]);
    expect(result.textBody).toBeNull();
  });

  it('should null opposite body type when updating draft with plain text', () => {
    const result = buildEmailBody('Hello', undefined, 'draft-1');
    expect(result.textBody).toEqual([{ partId: 'body-1', type: 'text/plain' }]);
    expect(result.htmlBody).toBeNull();
  });

  it('should default attachment type to octet-stream', () => {
    const attachments = [{ blobId: 'blob-1', name: 'unknown', type: '', size: 1234 }];
    const result = buildEmailBody('Hello', attachments);
    expect(result.bodyStructure?.subParts[1].type).toBe('application/octet-stream');
  });

  it('should use default disposition for attachments', () => {
    const attachments = [{ blobId: 'blob-1', name: 'file.pdf', type: 'application/pdf', size: 1234 }];
    const result = buildEmailBody('Hello', attachments);
    const attachmentPart = result.bodyStructure?.subParts[1];
    expect(attachmentPart).toMatchObject({
      blobId: 'blob-1',
      type: 'application/pdf',
      name: 'file.pdf',
      disposition: 'attachment',
    });
  });

  it('should handle empty attachments array', () => {
    const result = buildEmailBody('Hello', []);
    expect(result.bodyStructure).toBeUndefined();
    expect(result.textBody).toBeDefined();
  });
});
