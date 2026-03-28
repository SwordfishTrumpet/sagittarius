import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { jmapClient } from '../api/jmap';
import { eventSourceManager } from '../api/eventSource';
import { webSocketManager } from '../api/websocket';
import { logger } from '../utils/logger';

// --- DRY helpers for query invalidation and rollback ---

/**
 * Suppress new-mail notification sound for both push transports.
 * Call before any local Email mutation so the server's echoed state
 * change doesn't falsely play the notification.
 */
function suppressNewMailNotification() {
  eventSourceManager.suppressNotification();
  webSocketManager.suppressNotification();
}

/** Invalidate all email-related caches (threads, emails, emailDetail, mailboxes) */
function invalidateEmailQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['threads'] });
  qc.invalidateQueries({ queryKey: ['emails'] });
  qc.invalidateQueries({ queryKey: ['emailDetail'] });
  qc.invalidateQueries({ queryKey: ['mailboxes'] });
}

/** Invalidate only mailbox caches */
function invalidateMailboxQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['mailboxes'] });
}

/** Rollback a list of snapshotted query data (e.g. previousThreads, previousEmails) */
function rollbackQueries(qc: QueryClient, snapshots: [any, any][] | undefined) {
  if (snapshots && Array.isArray(snapshots)) {
    snapshots.forEach(([queryKey, data]) => {
      qc.setQueryData(queryKey, data);
    });
  }
}

/** Rollback a single keyed snapshot (e.g. mailboxes) */
function rollbackMailboxes(qc: QueryClient, accountId: string | null, previous: any) {
  if (previous) {
    qc.setQueryData(['mailboxes', accountId], previous);
  }
}

export function useMailboxes() {
  const accountId = jmapClient.getPrimaryAccount();
  logger.debug('useMailboxes - Current accountId:', accountId);
  
  return useQuery({
    queryKey: ['mailboxes', accountId],
    queryFn: async () => {
      if (!accountId) {
        logger.warn('useMailboxes: No accountId, skipping fetch');
        return [];
      }
      logger.debug('Fetching mailboxes for account:', accountId);
      try {
        const response = await jmapClient.request([
          ['Mailbox/get', {
            accountId,
            ids: null,
          }, '0'],
        ]);
        
        logger.debug('Mailbox response:', response);
        
        if (!response || !response.methodResponses || response.methodResponses.length === 0) {
          logger.error('Empty JMAP response for mailboxes');
          return [];
        }

        const methodRes = response.methodResponses[0];
        if (methodRes[0] === 'error') {
          logger.error('JMAP Method Error:', methodRes[1]);
          return [];
        }

        const list = methodRes[1].list;
        if (!list) {
          logger.error('No list in Mailbox/get response:', methodRes[1]);
          return [];
        }

        return list.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
      } catch (err) {
        logger.error('Failed to fetch mailboxes:', err);
        throw err;
      }
    },
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000, // Keep mailboxes fresh for 5 mins
  });
}

export function useEmails(mailboxId?: string, searchTerm?: string) {
  const accountId = jmapClient.getPrimaryAccount();
  
  return useQuery({
    queryKey: ['emails', accountId, mailboxId, searchTerm],
    queryFn: async () => {
      if (!mailboxId && !searchTerm) return [];
      
      const filter: any = {};
      if (mailboxId) filter.inMailbox = mailboxId;
      if (searchTerm) filter.text = searchTerm;

      // 1. Query for email IDs
      const queryResponse = await jmapClient.request([
        ['Email/query', {
          accountId,
          filter,
          sort: [{ property: 'receivedAt', isAscending: false }],
          limit: 50,
        }, '0'],
      ]);
      
      const ids = queryResponse.methodResponses[0][1].ids;
      if (!ids.length) return [];
      
      // 2. Fetch the email details for those IDs
      const getResponse = await jmapClient.request([
        ['Email/get', {
          accountId,
          ids,
          properties: ['id', 'threadId', 'mailboxIds', 'from', 'subject', 'preview', 'receivedAt', 'keywords', 'hasAttachment'],
        }, '1'],
      ]);
      
      return getResponse.methodResponses[0][1].list;
    },
    enabled: !!accountId && !!mailboxId,
  });
}

export function useThreads(mailboxId?: string, searchTerm?: string, quickFilters?: Record<string, any>) {
  const accountId = jmapClient.getPrimaryAccount();
  
  return useQuery({
    queryKey: ['threads', accountId, mailboxId, searchTerm, quickFilters ? JSON.stringify(quickFilters) : undefined],
    queryFn: async () => {
      if (!mailboxId && !searchTerm) return [];
      
      // Build mailbox/keyword conditions
      const mailboxConditions: any[] = [];
      if (mailboxId && mailboxId !== 'all' && mailboxId !== 'flagged') {
        mailboxConditions.push({ inMailbox: mailboxId });
      }
      if (mailboxId === 'flagged') {
        mailboxConditions.push({ hasKeyword: '$flagged' });
      }

      // Build search filter: use field-specific substring filters (from, to, subject)
      // combined with the full-text `text` filter via OR. The server's FTS tokenizer/stemmer
      // can prevent partial matches (e.g. "hell" won't match "hellemond" because the
      // stemmer treats "hell" as a complete word). The from/to/subject filters use
      // substring matching per RFC 8621, giving reliable partial results.
      let searchFilter: any = null;
      if (searchTerm) {
        searchFilter = {
          anyOf: [
            { from: searchTerm },
            { to: searchTerm },
            { subject: searchTerm },
            { text: searchTerm },
          ],
        };
      }

      // Combine all conditions with AND
      const allConditions = [...mailboxConditions, ...(searchFilter ? [searchFilter] : [])];
      const baseFilter = allConditions.length === 0
        ? {}
        : allConditions.length === 1
          ? allConditions[0]
          : { allOf: allConditions };

      // Merge quick filters (AND) with the base filter
      const filter = quickFilters && Object.keys(quickFilters).length > 0
        ? { allOf: [baseFilter, ...(quickFilters.allOf || [quickFilters])] }
        : baseFilter;

      // 1. Get thread IDs matching criteria
      const queryResponse = await jmapClient.request([
        ['Email/query', {
          accountId,
          filter,
          sort: [{ property: 'receivedAt', isAscending: false }],
          collapseThreads: true,
          limit: 100,
        }, '0'],
      ]);
      
      const ids = queryResponse.methodResponses[0][1].ids;
      if (!ids || ids.length === 0) return [];
      
      // 2. Fetch the "latest" email in each thread to show in list
      const getEmailsResponse = await jmapClient.request([
        ['Email/get', {
          accountId,
          ids,
          properties: ['id', 'threadId', 'mailboxIds', 'from', 'subject', 'preview', 'receivedAt', 'keywords', 'hasAttachment'],
        }, '1'],
      ]);
      
      const latestEmails = getEmailsResponse.methodResponses[0][1].list;
      if (!latestEmails || latestEmails.length === 0) return [];
      
      // 3. (Optional) Fetch thread details to see how many messages per thread
      const threadIds = Array.from(new Set(latestEmails.map((e: any) => e.threadId)));
      const threadsResponse = await jmapClient.request([
        ['Thread/get', {
          accountId,
          ids: threadIds,
        }, '2'],
      ]);

      const threads = threadsResponse.methodResponses[0][1].list;
      if (!threads) return latestEmails;
      
      const emailsWithThreadCount = latestEmails.map((email: any) => ({
        ...email,
        threadCount: threads.find((t: any) => t.id === email.threadId)?.emailIds?.length || 1
      }));

      // 4. If searching, fetch search snippets for highlighted results
      if (searchTerm && ids.length > 0) {
        try {
          const snippetFilter: any = {};
          if (mailboxId && mailboxId !== 'all' && mailboxId !== 'flagged') {
            snippetFilter.inMailbox = mailboxId;
          }
          if (mailboxId === 'flagged') {
            snippetFilter.hasKeyword = '$flagged';
          }
          snippetFilter.text = searchTerm;

          const snippetResponse = await jmapClient.request([
            ['SearchSnippet/get', {
              accountId,
              filter: snippetFilter,
              emailIds: ids,
            }, '3'],
          ]);

          const snippets = snippetResponse.methodResponses[0][1]?.list;
          if (snippets && snippets.length > 0) {
            const snippetMap = new Map(snippets.map((s: any) => [s.emailId, s]));
            return emailsWithThreadCount.map((email: any) => {
              const snippet = snippetMap.get(email.id) as any;
              return snippet ? { ...email, searchSnippet: snippet.preview || snippet.subject } : email;
            });
          }
        } catch (err) {
          logger.warn('SearchSnippet/get failed (may not be supported):', err);
        }
      }

      return emailsWithThreadCount;
    },
    enabled: !!accountId && (!!mailboxId || !!searchTerm),
  });
}

async function fetchEmailDetail(accountId: string, emailId: string, threadId?: string, queryClient?: any) {
  const idsToFetch = [emailId];
  
  if (threadId) {
    const threadResponse = await jmapClient.request([
      ['Thread/get', {
        accountId,
        ids: [threadId],
      }, '0'],
    ]);
    const threadEmailIds = threadResponse.methodResponses[0][1].list[0]?.emailIds;
    if (threadEmailIds) {
      idsToFetch.push(...threadEmailIds.filter((id: string) => id !== emailId));
    }
  }
  
      const response = await jmapClient.request([
        ['Email/get', {
          accountId,
          ids: idsToFetch,
          properties: ['id', 'threadId', 'mailboxIds', 'from', 'to', 'cc', 'bcc', 'subject', 'bodyValues', 'textBody', 'htmlBody', 'receivedAt', 'keywords', 'hasAttachment', 'attachments', 'bodyStructure', 'blobId', 'header:Disposition-Notification-To:asText'],
          fetchAllBodyValues: true,
        }, '1'],
      ]);
      
      const list = response.methodResponses[0][1].list;
      if (!list) return [];

      const emails = list.sort((a: any, b: any) => 
        new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()
      );

  // Mark the specifically selected email as seen if it's unread
  const selectedEmail = emails.find((e: any) => e.id === emailId);
  if (selectedEmail && (!selectedEmail.keywords || !selectedEmail.keywords['$seen'])) {
    // Suppress notification sound — marking as read is a local action
    suppressNewMailNotification();
    jmapClient.request([
      ['Email/set', {
        accountId,
        update: {
          [emailId]: {
            'keywords/$seen': true
          }
        }
      }, '0']
    ]).then(() => {
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ['threads'] });
        queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
      }
    });
  }

  return emails;
}

export function useEmailDetail(emailId?: string, threadId?: string) {
  const accountId = jmapClient.getPrimaryAccount();
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['emailDetail', accountId, emailId, threadId],
    queryFn: () => fetchEmailDetail(accountId!, emailId!, threadId, queryClient),
    enabled: !!accountId && !!emailId,
  });
}

export function useEmailActions() {
  const accountId = jmapClient.getPrimaryAccount();
  const queryClient = useQueryClient();

  const updateKeywords = useMutation({
    mutationFn: async ({ emailId, keywords }: { emailId: string, keywords: Record<string, boolean> }) => {
      // Build JMAP patch object: keywords/$flagged -> true/null
      const patch: Record<string, boolean | null> = {};
      for (const [key, value] of Object.entries(keywords)) {
        patch[`keywords/${key}`] = value ? true : null;
      }
      return jmapClient.request([
        ['Email/set', {
          accountId,
          update: {
            [emailId]: patch
          }
        }, '0']
      ]);
    },
    onMutate: async ({ emailId, keywords }) => {
      // Suppress notification sound for server echo of our own mutation
      suppressNewMailNotification();
      // Cancel any outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: ['emailDetail'] });
      await queryClient.cancelQueries({ queryKey: ['threads'] });

      // Snapshot the previous values
      const previousEmailDetail = queryClient.getQueryData(['emailDetail', accountId, emailId]);
      const previousThreads = queryClient.getQueriesData({ queryKey: ['threads'] });

      // Optimistically update emailDetail
      queryClient.setQueryData(['emailDetail', accountId, emailId], (old: any) => {
        if (!old) return old;
        return old.map((email: any) => 
          email.id === emailId 
            ? { ...email, keywords: { ...email.keywords, ...keywords } }
            : email
        );
      });

      // Optimistically update all thread queries (any mailbox/search combo)
      queryClient.getQueriesData({ queryKey: ['threads'] }).forEach(([queryKey, oldData]: any) => {
        if (!oldData) return;
        queryClient.setQueryData(queryKey, (old: any) => {
          if (!old) return old;
          return old.map((email: any) =>
            email.id === emailId
              ? { ...email, keywords: { ...email.keywords, ...keywords } }
              : email
          );
        });
      });

      return { previousEmailDetail, previousThreads };
    },
    onError: (err, newData, context: any) => {
      if (context?.previousEmailDetail) {
        queryClient.setQueryData(['emailDetail', accountId, newData.emailId], context.previousEmailDetail);
      }
      rollbackQueries(queryClient, context?.previousThreads);
    },
    onSuccess: () => invalidateEmailQueries(queryClient)
  });

  const updateKeywordsBulk = useMutation({
    mutationFn: async ({ emailIds, keywords }: { emailIds: string[], keywords: Record<string, boolean> }) => {
      // Build JMAP patch object: keywords/$flagged -> true/null
      const patch: Record<string, boolean | null> = {};
      for (const [key, value] of Object.entries(keywords)) {
        patch[`keywords/${key}`] = value ? true : null;
      }
      const updates: Record<string, Record<string, boolean | null>> = {};
      emailIds.forEach((id: string) => {
        updates[id] = patch;
      });
      return jmapClient.request([
        ['Email/set', {
          accountId,
          update: updates
        }, '0']
      ]);
    },
    onMutate: () => {
      suppressNewMailNotification();
    },
    onSuccess: () => invalidateEmailQueries(queryClient)
  });

  const moveEmail = useMutation({
     mutationFn: async ({ emailId, mailboxIds }: { emailId: string, mailboxIds: Record<string, boolean> }) => {
       return jmapClient.request([
         ['Email/set', {
           accountId,
           update: {
             [emailId]: { mailboxIds }
           }
         }, '0']
       ]);
     },
     onMutate: async ({ emailId, mailboxIds }) => {
       // Suppress notification sound for server echo of our own mutation
       suppressNewMailNotification();
       // Cancel any outgoing refetches so they don't overwrite optimistic update
       await queryClient.cancelQueries({ queryKey: ['threads'] });
       await queryClient.cancelQueries({ queryKey: ['emails'] });

       // Get destination mailbox IDs (new locations for the email)
       const destinationMailboxIds = Object.keys(mailboxIds).filter(id => mailboxIds[id]);

       // Snapshot ALL queries before mutation
       const previousThreads = queryClient.getQueriesData({ queryKey: ['threads'] });
       const previousEmails = queryClient.getQueriesData({ queryKey: ['emails'] });

       // CRITICAL FIX: Update threads queries
       // Remove from source mailboxes, don't remove from destination (it will be refetched)
       const threadQueriesSnapshot = queryClient.getQueriesData({ queryKey: ['threads'] });
       threadQueriesSnapshot.forEach(([queryKey, oldData]: any) => {
         if (!Array.isArray(oldData)) return;
         
         const queryParams = queryKey as any[];
         const queriedMailboxId = queryParams[2]; // mailbox ID is at index 2 in ['threads', accountId, mailboxId, searchTerm]
         
         // Check if this query is for a mailbox we're moving FROM
         // If the email was in this mailbox and we're NOT adding it to this mailbox, remove it
         const isDestination = destinationMailboxIds.includes(queriedMailboxId);
         
         if (!isDestination) {
           // This is potentially a source mailbox - remove the email
           queryClient.setQueryData(queryKey, oldData.filter((email: any) => email.id !== emailId));
         }
         // If destination, don't remove - let the server response add it via onSuccess refetch
       });

       // CRITICAL FIX: Update emails queries similarly
       const emailQueriesSnapshot = queryClient.getQueriesData({ queryKey: ['emails'] });
       emailQueriesSnapshot.forEach(([queryKey, oldData]: any) => {
         if (!Array.isArray(oldData)) return;
         
         const queryParams = queryKey as any[];
         const queriedMailboxId = queryParams[2]; // mailbox ID is at index 2 in ['emails', accountId, mailboxId, searchTerm]
         
         // Check if this query is for a mailbox we're moving FROM
         const isDestination = destinationMailboxIds.includes(queriedMailboxId);
         
         if (!isDestination) {
           // This is potentially a source mailbox - remove the email
           queryClient.setQueryData(queryKey, oldData.filter((email: any) => email.id !== emailId));
         }
         // If destination, don't remove - let the server response add it via onSuccess refetch
       });

       return { previousThreads, previousEmails };
     },
     onError: (err, newData, context: any) => {
       rollbackQueries(queryClient, context?.previousThreads);
       rollbackQueries(queryClient, context?.previousEmails);
     },
     onSuccess: () => {
       // Invalidate to refresh with server state - this will refetch ALL queries
       // which ensures destination mailbox gets the moved item and source mailboxes are cleared
       invalidateEmailQueries(queryClient);
     }
   });

  const moveEmailBulk = useMutation({
    mutationFn: async ({ emailIds, mailboxIds }: { emailIds: string[], mailboxIds: Record<string, boolean> }) => {
      const updates: Record<string, { mailboxIds: Record<string, boolean> }> = {};
      emailIds.forEach((id: string) => {
        updates[id] = { mailboxIds };
      });
      return jmapClient.request([
        ['Email/set', {
          accountId,
          update: updates
        }, '0']
      ]);
    },
    onMutate: async ({ emailIds, mailboxIds }) => {
      // Suppress notification sound for server echo of our own mutation
      suppressNewMailNotification();
      await queryClient.cancelQueries({ queryKey: ['threads'] });
      await queryClient.cancelQueries({ queryKey: ['emails'] });

      const destinationMailboxIds = Object.keys(mailboxIds).filter(id => mailboxIds[id]);
      const emailIdSet = new Set(emailIds);

      const previousThreads = queryClient.getQueriesData({ queryKey: ['threads'] });
      const previousEmails = queryClient.getQueriesData({ queryKey: ['emails'] });

      // Remove from source mailbox caches
      queryClient.getQueriesData({ queryKey: ['threads'] }).forEach(([queryKey, oldData]: any) => {
        if (!Array.isArray(oldData)) return;
        const queriedMailboxId = (queryKey as any[])[2];
        if (!destinationMailboxIds.includes(queriedMailboxId)) {
          queryClient.setQueryData(queryKey, oldData.filter((email: any) => !emailIdSet.has(email.id)));
        }
      });

      queryClient.getQueriesData({ queryKey: ['emails'] }).forEach(([queryKey, oldData]: any) => {
        if (!Array.isArray(oldData)) return;
        const queriedMailboxId = (queryKey as any[])[2];
        if (!destinationMailboxIds.includes(queriedMailboxId)) {
          queryClient.setQueryData(queryKey, oldData.filter((email: any) => !emailIdSet.has(email.id)));
        }
      });

      return { previousThreads, previousEmails };
    },
    onError: (err, newData, context: any) => {
      rollbackQueries(queryClient, context?.previousThreads);
      rollbackQueries(queryClient, context?.previousEmails);
    },
    onSuccess: () => invalidateEmailQueries(queryClient)
  });

  return { updateKeywords, updateKeywordsBulk, moveEmail, moveEmailBulk };
}

export function useMailboxActions() {
  const accountId = jmapClient.getPrimaryAccount();
  const queryClient = useQueryClient();

  const createMailbox = useMutation({
    mutationFn: async ({ name, parentId }: { name: string, parentId?: string }) => {
      const createObj: any = {
        name,
        isSubscribed: true,
      };
      if (parentId) {
        createObj.parentId = parentId;
      }
      
      return jmapClient.request([
        ['Mailbox/set', {
          accountId,
          create: {
            [`mailbox-${Date.now()}`]: createObj
          }
        }, '0']
      ]);
    },
    onSuccess: () => invalidateMailboxQueries(queryClient)
  });

  const renameMailbox = useMutation({
    mutationFn: async ({ mailboxId, newName }: { mailboxId: string, newName: string }) => {
      return jmapClient.request([
        ['Mailbox/set', {
          accountId,
          update: {
            [mailboxId]: { name: newName }
          }
        }, '0']
      ]);
    },
    onMutate: async ({ mailboxId, newName }) => {
      await queryClient.cancelQueries({ queryKey: ['mailboxes'] });
      
      const previousMailboxes = queryClient.getQueryData(['mailboxes', accountId]);
      
      queryClient.setQueryData(['mailboxes', accountId], (old: any) => {
        if (!old) return old;
        return old.map((mb: any) =>
          mb.id === mailboxId ? { ...mb, name: newName } : mb
        );
      });

      return { previousMailboxes };
    },
    onError: (_err, _data, context: any) => rollbackMailboxes(queryClient, accountId, context?.previousMailboxes),
    onSuccess: () => invalidateMailboxQueries(queryClient)
  });

  const deleteMailbox = useMutation({
    mutationFn: async ({ mailboxId }: { mailboxId: string }) => {
      return jmapClient.request([
        ['Mailbox/set', {
          accountId,
          destroy: [mailboxId]
        }, '0']
      ]);
    },
    onMutate: async ({ mailboxId }) => {
      await queryClient.cancelQueries({ queryKey: ['mailboxes'] });
      
      const previousMailboxes = queryClient.getQueryData(['mailboxes', accountId]);
      
      queryClient.setQueryData(['mailboxes', accountId], (old: any) => {
        if (!old) return old;
        return old.filter((mb: any) => mb.id !== mailboxId);
      });

      return { previousMailboxes };
    },
    onError: (_err, _data, context: any) => rollbackMailboxes(queryClient, accountId, context?.previousMailboxes),
    onSuccess: () => invalidateMailboxQueries(queryClient)
  });

  return { createMailbox, renameMailbox, deleteMailbox };
}

export function useMailboxReorder() {
  const accountId = jmapClient.getPrimaryAccount();
  const queryClient = useQueryClient();

  const reorderMailbox = useMutation({
    mutationFn: async (updates: { mailboxId: string; sortOrder: number }[]) => {
      const updateObj: Record<string, { sortOrder: number }> = {};
      updates.forEach(({ mailboxId, sortOrder }) => {
        updateObj[mailboxId] = { sortOrder };
      });
      return jmapClient.request([
        ['Mailbox/set', {
          accountId,
          update: updateObj,
        }, '0'],
      ]);
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['mailboxes'] });
      const previous = queryClient.getQueryData(['mailboxes', accountId]);

      queryClient.setQueryData(['mailboxes', accountId], (old: any) => {
        if (!old) return old;
        const orderMap = new Map(updates.map(u => [u.mailboxId, u.sortOrder]));
        return old.map((mb: any) =>
          orderMap.has(mb.id) ? { ...mb, sortOrder: orderMap.get(mb.id) } : mb
        );
      });

      return { previous };
    },
    onError: (_err, _data, context: any) => rollbackMailboxes(queryClient, accountId, context?.previous),
    onSuccess: () => invalidateMailboxQueries(queryClient),
  });

  const reparentMailbox = useMutation({
    mutationFn: async ({ mailboxId, newParentId }: { mailboxId: string; newParentId: string | null }) => {
      return jmapClient.request([
        ['Mailbox/set', {
          accountId,
          update: {
            [mailboxId]: { parentId: newParentId },
          },
        }, '0'],
      ]);
    },
    onMutate: async ({ mailboxId, newParentId }) => {
      await queryClient.cancelQueries({ queryKey: ['mailboxes'] });
      const previous = queryClient.getQueryData(['mailboxes', accountId]);

      queryClient.setQueryData(['mailboxes', accountId], (old: any) => {
        if (!old) return old;
        return old.map((mb: any) =>
          mb.id === mailboxId ? { ...mb, parentId: newParentId } : mb
        );
      });

      return { previous };
    },
    onError: (_err, _data, context: any) => rollbackMailboxes(queryClient, accountId, context?.previous),
    onSuccess: () => invalidateMailboxQueries(queryClient),
  });

  return { reorderMailbox, reparentMailbox };
}

export function useIdentities() {
  const accountId = jmapClient.getPrimaryAccount();
  return useQuery({
    queryKey: ['identities', accountId],
    queryFn: async () => {
      const response = await jmapClient.request([
        ['Identity/get', { accountId, ids: null }, '0'],
      ]);
      return response.methodResponses[0][1].list || [];
    },
    enabled: !!accountId,
    staleTime: 30 * 60 * 1000, // 30 min — identities rarely change
  });
}

export function useCompose() {
   const accountId = jmapClient.getPrimaryAccount();
   const queryClient = useQueryClient();

   return useMutation({
     mutationFn: async ({ to, cc, bcc, subject, body, attachments, identityId, fromEmail, sendAt }: { 
       to: { name?: string, email: string }[], 
       cc?: { name?: string, email: string }[], 
       bcc?: { name?: string, email: string }[], 
       subject: string, 
       body: string,
       attachments?: { blobId: string, name: string, type: string, size: number }[],
       identityId: string,
       fromEmail: string,
       sendAt?: string, // ISO 8601 date string for scheduled send
     }) => {
       // 1. Get draft & sent mailbox IDs
       const mailboxesRes = await jmapClient.request([
         ['Mailbox/get', { accountId, ids: null }, '0']
       ]);
       const draftBox = mailboxesRes.methodResponses[0][1].list.find((m: any) => m.role === 'drafts');
       const sentBox = mailboxesRes.methodResponses[0][1].list.find((m: any) => m.role === 'sent');

       if (!draftBox || !sentBox) throw new Error('Could not find Drafts or Sent mailbox');

       // 2. Create draft + submit in a single batched JMAP request
       //    Uses #draft-1 back-reference so the server links the two atomically
       const bodyPartType = body.includes('<') ? 'text/html' : 'text/plain';
       const bodyPartKey = bodyPartType === 'text/html' ? 'htmlBody' : 'textBody';

       const response = await jmapClient.request([
         ['Email/set', {
           accountId,
           create: {
             'draft-1': {
               mailboxIds: { [draftBox.id]: true },
                from: [{ name: null, email: fromEmail }],
               to,
               cc,
               bcc,
               subject,
               bodyValues: {
                 'body-1': {
                   value: body,
                   isTruncated: false
                 }
               },
               [bodyPartKey]: [{ partId: 'body-1', type: bodyPartType }],
               attachments: attachments?.map(a => ({
                 blobId: a.blobId,
                 type: a.type,
                 name: a.name,
                 size: a.size,
                 isInline: false
               })),
               keywords: { '$draft': true }
             }
           }
         }, '0'],
          ['EmailSubmission/set', {
            accountId,
            create: {
              'send-1': {
                emailId: '#draft-1',
                identityId,
                ...(sendAt ? { sendAt } : {}),
              }
            },
           onSuccessUpdateEmail: {
             '#send-1': {
               mailboxIds: { [sentBox.id]: true },
               'keywords/$draft': null,
               'keywords/$seen': true
             }
           }
         }, '1']
       ]);

       // 3. Check for errors in either method response
       for (const [method, result] of response.methodResponses) {
         if (method === 'error') {
           throw new Error(`JMAP error: ${result.type} — ${result.description || 'Unknown error'}`);
         }
         if (result.notCreated) {
           const firstError = Object.values(result.notCreated)[0] as any;
           throw new Error(`Failed to create: ${firstError?.type || 'Unknown error'}`);
         }
       }

       return response;
     },
     onMutate: () => {
       suppressNewMailNotification();
     },
     onSuccess: () => invalidateEmailQueries(queryClient)
   });
 }
