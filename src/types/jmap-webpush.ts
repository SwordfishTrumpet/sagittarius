export interface PushSubscription {
  id: string;
  deviceClientId: string;
  url: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expires?: string | null;
  types?: string[] | null;
}

export interface PushSubscriptionGetRequest {
  accountId: string;
  ids: string[] | null;
  properties?: string[] | null;
}

export interface PushSubscriptionGetResponse {
  accountId: string;
  list: PushSubscription[];
  notFound?: string[];
}

export interface PushSubscriptionSetRequest {
  accountId: string;
  ifInState?: string | null;
  create?: Record<string, Omit<PushSubscription, 'id'>>;
  update?: Record<string, Partial<Omit<PushSubscription, 'id'>>>;
  destroy?: string[];
}

export interface PushSubscriptionSetResponse {
  accountId: string;
  oldState?: string | null;
  newState: string;
  created?: Record<string, PushSubscription>;
  updated?: Record<string, Partial<PushSubscription> | null>;
  destroyed?: string[];
  notCreated?: Record<string, { type: string; description?: string }>;
  notUpdated?: Record<string, { type: string; description?: string }>;
  notDestroyed?: Record<string, { type: string; description?: string }>;
}
