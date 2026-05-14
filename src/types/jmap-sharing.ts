export interface Principal {
  id: string;
  name: string;
  email?: string;
  type: 'individual' | 'group' | 'resource' | 'unknown';
  description?: string | null;
}

export interface ShareRights {
  mayRead: boolean;
  mayWrite: boolean;
  mayDelete: boolean;
  mayAdmin: boolean;
  mayShare: boolean;
}

export interface SharingCapability {
  maxPrincipals?: number | null;
}

export interface PrincipalGetRequest {
  accountId: string;
  ids: string[] | null;
  properties?: string[] | null;
}

export interface PrincipalGetResponse {
  accountId: string;
  state: string;
  list: Principal[];
  notFound?: string[];
}

export interface PrincipalQueryRequest {
  accountId: string;
  filter?: {
    text?: string;
    email?: string;
    type?: string;
  };
  sort?: Array<{ property: string; isAscending?: boolean }>;
  position?: number;
  limit?: number;
}

export interface PrincipalQueryResponse {
  accountId: string;
  queryState: string;
  canCalculateChanges: boolean;
  position: number;
  total?: number;
  ids: string[];
}
