/**
 * RFC 9404 Blob Management Extension Types
 * 
 * This module defines types for the JMAP Blob Management extension per RFC 9404.
 * It includes Blob/upload, Blob/get, Blob/lookup, and Blob/copy methods.
 * 
 * @see https://datatracker.ietf.org/doc/html/rfc9404
 */

// ============ Capability Types ============

/**
 * The account-specific blob capability configuration.
 * Returned in accountCapabilities for urn:ietf:params:jmap:blob
 */
export interface BlobCapability {
  /** Maximum size of blob (in octets) that server allows to be created */
  maxSizeBlobSet: number | null;
  /** Maximum number of DataSourceObjects allowed per creation in Blob/upload */
  maxDataSources: number;
  /** Data type names supported for Blob/lookup */
  supportedTypeNames: string[];
  /** Supported digest algorithms for Blob/get (lowercased per RFC 3230) */
  supportedDigestAlgorithms: string[];
}

/**
 * Known JMAP data types that can reference blobs (from RFC 9404 §6.3)
 */
export type BlobReferenceableType =
  | 'Mailbox'
  | 'Thread'
  | 'Email'
  | 'EmailDelivery'
  | 'Identity'
  | 'EmailSubmission'
  | 'VacationResponse'
  | 'MDN';

// ============ Data Source Types ============

/**
 * DataSourceObject for Blob/upload
 * Exactly one of data:asText, data:asBase64, or blobId must be specified
 */
export interface DataSourceAsText {
  /** Raw octets as UTF-8 text */
  'data:asText': string;
}

export interface DataSourceAsBase64 {
  /** Base64 representation of octets */
  'data:asBase64': string;
}

export interface DataSourceBlob {
  /** BlobId to source data from */
  blobId: string;
  /** Offset in octets (null = 0) */
  offset?: number | null;
  /** Length in octets (null = remaining) */
  length?: number | null;
}

export type DataSourceObject = DataSourceAsText | DataSourceAsBase64 | DataSourceBlob;

// ============ Blob/upload Types ============

/**
 * UploadObject for Blob/upload create parameter
 */
export interface UploadObject {
  /** Array of data sources to concatenate */
  data: DataSourceObject[];
  /** Media type hint (null = let server decide) */
  type?: string | null;
}

/**
 * Blob/upload request arguments
 */
export interface BlobUploadRequest {
  accountId: string;
  create: Record<string, UploadObject>;
  [key: string]: unknown;
}

/**
 * Created blob response object
 */
export interface CreatedBlob {
  /** The blobId that was created */
  id: string;
  /** Media type (may be null or calculated by server) */
  type: string | null;
  /** Size in octets */
  size: number;
}

/**
 * Blob/upload response (similar to Foo/set but no state)
 */
export interface BlobUploadResponse {
  accountId: string;
  created?: Record<string, CreatedBlob>;
  notCreated?: Record<string, BlobSetError>;
}

// ============ Blob/get Types ============

/**
 * Blob/get request arguments
 */
export interface BlobGetRequest {
  accountId: string;
  ids: string[];
  /** Properties to fetch: data:asText, data:asBase64, data, digest:<alg>, size */
  properties?: string[];
  /** Start offset (default 0) */
  offset?: number | null;
  /** Maximum length to return (default = all remaining) */
  length?: number | null;
  [key: string]: unknown;
}

/**
 * Blob object returned by Blob/get
 */
export interface BlobData {
  /** Blob ID */
  id: string;
  /** Size of entire blob in octets */
  size: number;
  /** Text data if valid UTF-8, null otherwise */
  'data:asText'?: string | null;
  /** Base64 encoded data */
  'data:asBase64'?: string;
  /** Dynamic digest properties (e.g., digest:sha, digest:sha-256) */
  [digestKey: `digest:${string}`]: string | undefined;
  /** True if data contains invalid UTF-8 */
  isEncodingProblem?: boolean;
  /** True if requested range exceeded blob size */
  isTruncated?: boolean;
}

/**
 * Blob/get response
 */
export interface BlobGetResponse {
  accountId: string;
  list: BlobData[];
  notFound?: string[];
}

// ============ Blob/lookup Types ============

/**
 * Blob/lookup request arguments
 */
export interface BlobLookupRequest {
  accountId: string;
  /** Type names to search (e.g., 'Mailbox', 'Email', 'Thread') */
  typeNames: string[];
  /** Blob IDs to look up */
  ids: string[];
  [key: string]: unknown;
}

/**
 * Matched IDs for a single blob
 * Maps type name to array of object IDs that reference the blob
 */
export type BlobMatchedIds = Record<string, string[]>;

/**
 * Blob info returned by lookup
 */
export interface BlobInfo {
  /** The blobId */
  id: string;
  /** Map from type name to list of IDs of that data type */
  matchedIds: BlobMatchedIds;
}

/**
 * Blob/lookup response
 */
export interface BlobLookupResponse {
  accountId: string;
  list: BlobInfo[];
  notFound?: string[];
}

// ============ Blob/copy Types (RFC 8620) ============

/**
 * Blob/copy request arguments per RFC 8620
 */
export interface BlobCopyRequest {
  accountId: string;
  /** The ID of the account to copy blobs from */
  fromAccountId: string;
  ids: string[];
  [key: string]: unknown;
}

/**
 * Copied blob info
 */
export interface CopiedBlob {
  /** New blobId in the destination account */
  id: string;
  /** Size in octets */
  size: number;
}

/**
 * Blob/copy response
 */
export interface BlobCopyResponse {
  accountId: string;
  fromAccountId: string;
  copied?: Record<string, CopiedBlob>;
  notCopied?: Record<string, BlobSetError>;
}

// ============ Error Types ============

/**
 * Error object for blob operations
 */
export interface BlobSetError {
  type: string;
  description?: string;
  properties?: string[];
}

/**
 * Error types specific to blob operations
 */
export type BlobErrorType =
  | 'unknownDataType' // Type name not recognized or capability not present
  | 'invalidArguments'
  | 'notFound'
  | 'invalidBlobId'
  | 'invalidRange'; // Range extends past blob data

// ============ Helper Functions ============

/**
 * Check if an error is a blob-specific unknownDataType error
 */
export function isUnknownDataTypeError(error: { type?: string }): boolean {
  return error.type === 'unknownDataType';
}

/**
 * Type guard for BlobData checking if it has valid text data
 */
export function hasValidText(blobData: BlobData): boolean {
  return !blobData.isEncodingProblem && blobData['data:asText'] !== null;
}

/**
 * Get digest value for a specific algorithm from blob data
 */
export function getDigest(blobData: BlobData, algorithm: string): string | undefined {
  return blobData[`digest:${algorithm.toLowerCase()}`];
}

/**
 * Create a DataSourceObject from text content
 */
export function createTextDataSource(text: string): DataSourceAsText {
  return { 'data:asText': text };
}

/**
 * Create a DataSourceObject from base64 content
 */
export function createBase64DataSource(base64: string): DataSourceAsBase64 {
  return { 'data:asBase64': base64 };
}

/**
 * Create a DataSourceObject referencing another blob
 */
export function createBlobDataSource(
  blobId: string,
  offset?: number,
  length?: number
): DataSourceBlob {
  const source: DataSourceBlob = { blobId };
  if (offset !== undefined) source.offset = offset;
  if (length !== undefined) source.length = length;
  return source;
}
