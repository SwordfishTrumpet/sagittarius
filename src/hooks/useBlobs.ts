/**
 * useBlobs - React Query hooks for RFC 9404 Blob Management
 * 
 * Provides hooks for:
 * - Blob/copy: Copy blobs between accounts
 * - Blob/lookup: Find objects referencing specific blobs
 * - Blob/upload: Create blobs from data sources
 * - Blob/get: Fetch blob data with optional range
 * 
 * @see https://datatracker.ietf.org/doc/html/rfc9404
 */

import { useMutation, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';
import { jmapClient } from '../api/jmap';
import type {
  BlobCapability,
  BlobCopyResponse,
  BlobLookupResponse,
  BlobUploadResponse,
  BlobGetResponse,
  DataSourceObject,
  CreatedBlob,
  BlobReferenceableType,
} from '../types/jmap-blob';

// ============ Blob Capability Query ============

const BLOB_CAPABILITY_KEY = 'blob-capability';

/**
 * Hook to check if server supports RFC 9404 Blob Management
 * and get account-specific capability configuration
 */
export function useBlobCapability(
  options?: Omit<
    UseQueryOptions<BlobCapability | null, Error, BlobCapability | null, [string, string | null]>,
    'queryKey' | 'queryFn' | 'enabled'
  >
) {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery({
    queryKey: [BLOB_CAPABILITY_KEY, accountId],
    queryFn: () => {
      return Promise.resolve(jmapClient.getBlobCapability());
    },
    enabled: !!accountId && jmapClient.hasBlobCapability(),
    staleTime: Infinity, // Capability doesn't change during session
    ...options,
  });
}

// ============ Blob Copy Mutation ============

export interface CopyBlobsVariables {
  fromAccountId: string;
  blobIds: string[];
  toAccountId?: string;
}

/**
 * Mutation hook for Blob/copy - copy blobs between accounts
 */
export function useBlobCopy() {
  return useMutation<BlobCopyResponse, Error, CopyBlobsVariables>({
    mutationFn: async ({ fromAccountId, blobIds, toAccountId }) => {
      return jmapClient.copyBlobs(fromAccountId, blobIds, toAccountId);
    },
    onError: (error) => {
      toast.error(`Blob copy failed: ${error.message}`);
    },
  });
}

// ============ Blob Lookup Query ============

const BLOB_LOOKUP_KEY = 'blob-lookup';

export interface BlobLookupOptions {
  blobIds: string[];
  typeNames: BlobReferenceableType[];
  accountId?: string;
}

/**
 * Query hook for Blob/lookup - find objects referencing blobs
 */
export function useBlobLookup(
  options: BlobLookupOptions,
  queryOptions?: Omit<
    UseQueryOptions<BlobLookupResponse, Error, BlobLookupResponse, [string, string, string[]]>,
    'queryKey' | 'queryFn' | 'enabled'
  >
) {
  const targetAccountId = options.accountId ?? jmapClient.getPrimaryAccount();
  const enabled =
    !!targetAccountId &&
    jmapClient.hasBlobCapability() &&
    options.blobIds.length > 0 &&
    options.typeNames.length > 0;

  return useQuery({
    queryKey: [BLOB_LOOKUP_KEY, targetAccountId || 'null', options.blobIds],
    queryFn: async () => {
      return jmapClient.lookupBlobs(options.blobIds, options.typeNames, targetAccountId!);
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - references don't change often
    ...queryOptions,
  });
}

// ============ Blob Data Query ============

const BLOB_DATA_KEY = 'blob-data';

export interface BlobDataOptions {
  blobIds: string[];
  properties?: string[];
  offset?: number;
  length?: number;
  accountId?: string;
}

/**
 * Query hook for Blob/get - fetch blob data with optional range
 */
export function useBlobData(
  options: BlobDataOptions,
  queryOptions?: Omit<
    UseQueryOptions<BlobGetResponse, Error, BlobGetResponse, [string, string, string[], string[] | undefined, number | undefined, number | undefined]>,
    'queryKey' | 'queryFn' | 'enabled'
  >
) {
  const targetAccountId = options.accountId ?? jmapClient.getPrimaryAccount();
  const enabled =
    !!targetAccountId &&
    jmapClient.hasBlobCapability() &&
    options.blobIds.length > 0;

  return useQuery({
    queryKey: [
      BLOB_DATA_KEY,
      targetAccountId || 'null',
      options.blobIds,
      options.properties,
      options.offset,
      options.length,
    ] as [string, string, string[], string[] | undefined, number | undefined, number | undefined],
    queryFn: async () => {
      return jmapClient.getBlobData(options.blobIds, {
        properties: options.properties,
        offset: options.offset,
        length: options.length,
        accountId: targetAccountId!,
      });
    },
    enabled,
    // Blob data can be large, cache for shorter time
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
    ...queryOptions,
  });
}

// ============ Blob Upload Mutation ============

export interface UploadBlobsVariables {
  uploads: Record<string, { data: DataSourceObject[]; type?: string | null }>;
  accountId?: string;
}

/**
 * Mutation hook for Blob/upload - create blobs from data sources
 */
export function useBlobUpload() {
  return useMutation<BlobUploadResponse, Error, UploadBlobsVariables>({
    mutationFn: async ({ uploads, accountId }) => {
      return jmapClient.uploadBlobData(uploads, accountId);
    },
    onSuccess: () => {
      toast.success('Blob created successfully');
    },
    onError: (error) => {
      toast.error(`Blob upload failed: ${error.message}`);
    },
  });
}

// ============ Convenience Mutations ============

export interface CreateBlobFromTextVariables {
  content: string;
  type?: string | null;
  accountId?: string;
}

/**
 * Mutation hook to create a single blob from text content
 */
export function useCreateBlobFromText() {
  return useMutation<CreatedBlob, Error, CreateBlobFromTextVariables>({
    mutationFn: async ({ content, type, accountId }) => {
      return jmapClient.createBlobFromText(content, type, accountId);
    },
    onError: (error) => {
      toast.error(`Failed to create blob: ${error.message}`);
    },
  });
}

export interface CreateBlobFromBase64Variables {
  base64Content: string;
  type?: string | null;
  accountId?: string;
}

/**
 * Mutation hook to create a single blob from base64 content
 */
export function useCreateBlobFromBase64() {
  return useMutation<CreatedBlob, Error, CreateBlobFromBase64Variables>({
    mutationFn: async ({ base64Content, type, accountId }) => {
      return jmapClient.createBlobFromBase64(base64Content, type, accountId);
    },
    onError: (error) => {
      toast.error(`Failed to create blob: ${error.message}`);
    },
  });
}

// ============ Utility Hooks ============

/**
 * Check if RFC 9404 blob operations are available
 */
export function useHasBlobCapability(): boolean {
  return jmapClient.hasBlobCapability();
}

/**
 * Get supported type names for Blob/lookup
 */
export function useSupportedLookupTypes(): string[] {
  const cap = jmapClient.getBlobCapability();
  return cap?.supportedTypeNames ?? [];
}

/**
 * Get supported digest algorithms for Blob/get
 */
export function useSupportedDigestAlgorithms(): string[] {
  const cap = jmapClient.getBlobCapability();
  return cap?.supportedDigestAlgorithms ?? [];
}

/**
 * Get max data sources limit for Blob/upload
 */
export function useMaxDataSources(): number {
  const cap = jmapClient.getBlobCapability();
  return cap?.maxDataSources ?? 64; // RFC requires at least 64
}

/**
 * Get max blob size limit
 */
export function useMaxBlobSize(): number | null {
  const cap = jmapClient.getBlobCapability();
  return cap?.maxSizeBlobSet ?? null;
}
