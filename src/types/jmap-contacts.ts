/**
 * RFC 9610 JMAP for Contacts Type Definitions
 * 
 * This module defines types for the JMAP Contacts extension per RFC 9610.
 * It includes AddressBook and ContactCard data types with their associated
 * JMAP methods: get, changes, set, query, queryChanges, and copy.
 * 
 * @see https://datatracker.ietf.org/doc/html/rfc9610
 */

// ============ Capability Types ============

/**
 * The account-specific contacts capability configuration.
 * Returned in accountCapabilities for urn:ietf:params:jmap:contacts
 */
export interface ContactsCapability {
  /** Maximum number of AddressBooks that can be assigned to a single ContactCard */
  maxAddressBooksPerCard: number | null;
  /** The user may create an AddressBook in this account */
  mayCreateAddressBook: boolean;
}

// ============ AddressBook Types ============

/**
 * Access rights for an AddressBook
 */
export interface AddressBookRights {
  /** The user may fetch the ContactCards in this AddressBook */
  mayRead: boolean;
  /** The user may create, modify, or destroy all ContactCards in this AddressBook */
  mayWrite: boolean;
  /** The user may modify the "shareWith" property for this AddressBook */
  mayShare: boolean;
  /** The user may delete the AddressBook itself */
  mayDelete: boolean;
}

/**
 * AddressBook object per RFC 9610 §2
 * A named collection of ContactCards
 */
export interface AddressBook {
  /** The id of the AddressBook (immutable, server-set) */
  id: string;
  /** The user-visible name of the AddressBook */
  name: string;
  /** An optional long-form description */
  description: string | null;
  /** Defines the sort order of AddressBooks in the UI */
  sortOrder: number;
  /** True for exactly one AddressBook in an account (the default) */
  isDefault: boolean;
  /** True if the user wishes to see this AddressBook */
  isSubscribed: boolean;
  /** Map of Principal id to rights for shared AddressBooks */
  shareWith: Record<string, AddressBookRights> | null;
  /** The set of access rights the user has for this AddressBook */
  myRights: AddressBookRights;
}

// ============ JSContact Card Types (RFC 9553) ============

/**
 * Name component for a contact's name
 */
export interface NameComponent {
  /** The kind of name component (e.g., 'given', 'surname', 'surname2') */
  kind: string;
  /** The value of this name component */
  value: string;
}

/**
 * Name object for a contact
 */
export interface ContactName {
  /** Components that make up the name */
  components: NameComponent[];
  /** Full name as a single string */
  full?: string;
  /** Whether the components are in order */
  isOrdered?: boolean;
}

/**
 * Nickname object
 */
export interface Nickname {
  name: string;
}

/**
 * Organization object
 */
export interface Organization {
  name: string;
}

/**
 * Email address object
 */
export interface EmailAddress {
  /** The email address */
  address: string;
  /** Contexts where this email is used (e.g., 'private', 'work') */
  contexts?: Record<string, boolean>;
  /** Label for this email */
  label?: string;
}

/**
 * Phone number object
 */
export interface Phone {
  /** The phone number */
  number: string;
  /** Contexts where this phone is used */
  contexts?: Record<string, boolean>;
  /** Label for this phone */
  label?: string;
}

/**
 * Online service (e.g., social media, messaging)
 */
export interface OnlineService {
  /** The service name */
  service?: string;
  /** The URI for the service */
  uri?: string;
  /** Username/handle on the service */
  user?: string;
  /** Label for this service */
  label?: string;
  /** Contexts where this service is used */
  contexts?: Record<string, boolean>;
}

/**
 * Address component (street, city, etc.)
 */
export interface AddressComponent {
  /** The kind of address component (e.g., 'street', 'locality', 'region') */
  kind: string;
  /** The value */
  value: string;
}

/**
 * Postal address object
 */
export interface Address {
  /** Components that make up the address */
  components: AddressComponent[];
  /** Full address as a single string */
  full?: string;
  /** Label for this address */
  label?: string;
  /** Contexts where this address is used */
  contexts?: Record<string, boolean>;
}

/**
 * Media object (photo, logo, etc.)
 */
export interface Media {
  /** URI for the media resource */
  uri?: string;
  /** Blob ID for the media (preferred for large files) */
  blobId?: string;
  /** Media type */
  mediaType?: string;
}

/**
 * Title (job title) per RFC 9553 §2.3.1
 */
export interface Title {
  /** The job title value */
  value: string;
  /** Contexts where this title is used (e.g., 'work', 'private') */
  contexts?: Record<string, boolean>;
  /** Label for this title */
  label?: string;
}

/**
 * Note about a contact
 */
export interface Note {
  note: string;
}

/**
 * ContactCard object per RFC 9610 §3 and RFC 9553
 * Contains information about a person, company, or other entity
 */
export interface ContactCard {
  /** The id of the ContactCard (immutable, server-set) */
  id: string;
  /** The set of AddressBook ids this card belongs to */
  addressBookIds: Record<string, boolean>;
  /** Unique identifier (different from id) */
  uid?: string;
  /** The kind of contact ('individual', 'organization', 'group', etc.) */
  kind?: string;
  /** Creation timestamp */
  created?: string;
  /** Last updated timestamp */
  updated?: string;
  /** The name of the contact */
  name?: ContactName;
  /** Nicknames for the contact */
  nicknames?: Record<string, Nickname>;
  /** Organizations the contact belongs to */
  organizations?: Record<string, Organization>;
  /** Job titles per RFC 9553 §2.3.1 */
  title?: Record<string, Title>;
  /** Email addresses */
  emails?: Record<string, EmailAddress>;
  /** Phone numbers */
  phones?: Record<string, Phone>;
  /** Online services */
  onlineServices?: Record<string, OnlineService>;
  /** Postal addresses */
  addresses?: Record<string, Address>;
  /** Photos or images of the contact */
  photos?: Record<string, Media>;
  /** Notes about the contact */
  notes?: Record<string, Note>;
  /** Members (for group contacts) - map of uid to true per RFC 9610 §3 */
  members?: Record<string, boolean>;
}

// ============ Filter Types ============

/**
 * ContactCard Filter Condition per RFC 9610 §3.3.1
 */
export interface ContactCardFilterCondition {
  /** ContactCard IDs to match */
  ids?: string[];
  /** An AddressBook id - card must be in this address book */
  inAddressBook?: string;
  /** A card must have this string exactly as its uid */
  uid?: string;
  /** A card must have this uid in its members property */
  hasMember?: string;
  /** A card must have this kind property */
  kind?: string;
  /** The created date must be before this date-time */
  createdBefore?: string;
  /** The created date must be the same or after this date-time */
  createdAfter?: string;
  /** The updated date must be before this date-time */
  updatedBefore?: string;
  /** The updated date must be the same or after this date-time */
  updatedAfter?: string;
  /** Text search across the card */
  text?: string;
  /** Matches name components or full name */
  name?: string;
  /** Matches a NameComponent with kind "given" */
  'name/given'?: string;
  /** Matches a NameComponent with kind "surname" */
  'name/surname'?: string;
  /** Matches a NameComponent with kind "surname2" */
  'name/surname2'?: string;
  /** Matches nicknames */
  nickname?: string;
  /** Matches organization names */
  organization?: string;
  /** Matches email addresses or labels */
  email?: string;
  /** Matches phone numbers or labels */
  phone?: string;
  /** Matches online services */
  onlineService?: string;
  /** Matches address components or full address */
  address?: string;
  /** Matches notes */
  note?: string;
}

/**
 * ContactCard Filter Operator for combining conditions
 */
export interface ContactCardFilterOperator {
  /** AND - all conditions must match */
  allOf?: (ContactCardFilterCondition | ContactCardFilterOperator)[];
  /** OR - any condition can match */
  anyOf?: (ContactCardFilterCondition | ContactCardFilterOperator)[];
  /** NOT - condition must not match */
  not?: ContactCardFilterCondition | ContactCardFilterOperator;
}

/** Combined ContactCard Filter type */
export type ContactCardFilter = ContactCardFilterCondition | ContactCardFilterOperator;

/**
 * AddressBook Filter Condition
 */
export interface AddressBookFilterCondition {
  /** AddressBook IDs to match */
  ids?: string[];
  /** Name contains this string */
  name?: string;
  /** Is the default AddressBook */
  isDefault?: boolean;
  /** Is subscribed */
  isSubscribed?: boolean;
}

/**
 * AddressBook Filter Operator
 */
export interface AddressBookFilterOperator {
  /** AND - all conditions must match */
  allOf?: (AddressBookFilterCondition | AddressBookFilterOperator)[];
  /** OR - any condition can match */
  anyOf?: (AddressBookFilterCondition | AddressBookFilterOperator)[];
  /** NOT - condition must not match */
  not?: AddressBookFilterCondition | AddressBookFilterOperator;
}

/** Combined AddressBook Filter type */
export type AddressBookFilter = AddressBookFilterCondition | AddressBookFilterOperator;

// ============ Request/Response Types ============

/**
 * AddressBook/get request arguments
 */
export interface AddressBookGetRequest {
  accountId: string;
  /** IDs to fetch (null for all) */
  ids: string[] | null;
  /** Properties to fetch (null for all) */
  properties?: string[] | null;
}

/**
 * AddressBook/get response
 */
export interface AddressBookGetResponse {
  accountId: string;
  state: string;
  list: AddressBook[];
  notFound?: string[];
}

/**
 * AddressBook/changes request arguments
 */
export interface AddressBookChangesRequest {
  accountId: string;
  sinceState: string;
  maxChanges?: number;
}

/**
 * AddressBook/changes response
 */
export interface AddressBookChangesResponse {
  accountId: string;
  oldState: string;
  newState: string;
  hasMoreChanges: boolean;
  created: string[];
  updated: string[];
  destroyed: string[];
}

/**
 * AddressBook/set request arguments
 */
export interface AddressBookSetRequest {
  accountId: string;
  ifInState?: string | null;
  create?: Record<string, Omit<AddressBook, 'id'>>;
  update?: Record<string, Partial<AddressBook>>;
  destroy?: string[];
  onDestroyRemoveContents?: boolean;
  onSuccessSetIsDefault?: string | null;
}

/**
 * AddressBook/set error for individual items
 */
export interface AddressBookSetError {
  type: string;
  description?: string;
  properties?: string[];
}

/**
 * AddressBook/set response
 */
export interface AddressBookSetResponse {
  accountId: string;
  oldState?: string;
  newState: string;
  created?: Record<string, AddressBook>;
  updated?: Record<string, Partial<AddressBook> | null>;
  destroyed?: string[];
  notCreated?: Record<string, AddressBookSetError>;
  notUpdated?: Record<string, AddressBookSetError>;
  notDestroyed?: Record<string, AddressBookSetError>;
}

/**
 * ContactCard/get request arguments
 */
export interface ContactCardGetRequest {
  accountId: string;
  /** IDs to fetch (null for all) */
  ids: string[] | null;
  /** Properties to fetch (null for all) */
  properties?: string[] | null;
}

/**
 * ContactCard/get response
 */
export interface ContactCardGetResponse {
  accountId: string;
  state: string;
  list: ContactCard[];
  notFound?: string[];
}

/**
 * ContactCard/changes request arguments
 */
export interface ContactCardChangesRequest {
  accountId: string;
  sinceState: string;
  maxChanges?: number;
}

/**
 * ContactCard/changes response
 */
export interface ContactCardChangesResponse {
  accountId: string;
  oldState: string;
  newState: string;
  hasMoreChanges: boolean;
  created: string[];
  updated: string[];
  destroyed: string[];
}

/**
 * ContactCard/query request arguments
 */
export interface ContactCardQueryRequest {
  accountId: string;
  filter?: ContactCardFilter;
  sort?: Array<{
    property: string;
    isAscending?: boolean;
  }>;
  position?: number;
  anchorId?: string;
  anchorOffset?: number;
  limit?: number;
  calculateTotal?: boolean;
}

/**
 * ContactCard/query response
 */
export interface ContactCardQueryResponse {
  accountId: string;
  queryState: string;
  canCalculateChanges: boolean;
  position: number;
  ids: string[];
  total?: number;
  limit?: number;
}

/**
 * ContactCard/queryChanges request arguments
 */
export interface ContactCardQueryChangesRequest {
  accountId: string;
  filter?: ContactCardFilter;
  sort?: Array<{
    property: string;
    isAscending?: boolean;
  }>;
  sinceQueryState: string;
  maxChanges?: number;
  upToId?: string;
  calculateTotal?: boolean;
}

/**
 * ContactCard/queryChanges response
 */
export interface ContactCardQueryChangesResponse {
  accountId: string;
  oldQueryState: string;
  newQueryState: string;
  hasMoreChanges: boolean;
  total?: number;
  removed: string[];
  added: Array<{
    id: string;
    index: number;
  }>;
}

/**
 * ContactCard/set request arguments
 */
export interface ContactCardSetRequest {
  accountId: string;
  ifInState?: string | null;
  create?: Record<string, Omit<ContactCard, 'id'>>;
  update?: Record<string, Partial<ContactCard>>;
  destroy?: string[];
}

/**
 * ContactCard/set error for individual items
 */
export interface ContactCardSetError {
  type: string;
  description?: string;
  properties?: string[];
}

/**
 * ContactCard/set response
 */
export interface ContactCardSetResponse {
  accountId: string;
  oldState?: string;
  newState: string;
  created?: Record<string, ContactCard>;
  updated?: Record<string, Partial<ContactCard> | null>;
  destroyed?: string[];
  notCreated?: Record<string, ContactCardSetError>;
  notUpdated?: Record<string, ContactCardSetError>;
  notDestroyed?: Record<string, ContactCardSetError>;
}

/**
 * ContactCard/copy request arguments
 */
export interface ContactCardCopyRequest {
  accountId: string;
  fromAccountId: string;
  create: Record<string, string>;
  onSuccessDestroyOriginal?: boolean;
}

/**
 * Copied ContactCard info
 */
export interface CopiedContactCard {
  id: string;
}

/**
 * ContactCard/copy response
 */
export interface ContactCardCopyResponse {
  accountId: string;
  fromAccountId: string;
  created?: Record<string, CopiedContactCard>;
  notCreated?: Record<string, ContactCardSetError>;
}

// ============ Error Types ============

/**
 * Error types specific to contacts operations
 */
export type ContactsErrorType =
  | 'addressBookHasContents' // AddressBook has ContactCards and onDestroyRemoveContents was false
  | 'invalidProperties'
  | 'notFound'
  | 'forbidden';

// ============ Helper Functions ============

/**
 * Get the full name from a ContactCard
 */
export function getContactFullName(contact: ContactCard): string {
  if (contact.name?.full) {
    return contact.name.full;
  }
  if (contact.name?.components) {
    return contact.name.components.map(c => c.value).join(' ');
  }
  return 'Unnamed Contact';
}

/**
 * Get the primary email address from a ContactCard
 */
export function getContactPrimaryEmail(contact: ContactCard): string | null {
  if (!contact.emails) return null;
  const emails = Object.values(contact.emails);
  // Prefer email with private context
  const privateEmail = emails.find(e => e.contexts?.private);
  if (privateEmail) return privateEmail.address;
  // Otherwise return first email
  return emails[0]?.address || null;
}

/**
 * Get the primary phone number from a ContactCard
 */
export function getContactPrimaryPhone(contact: ContactCard): string | null {
  if (!contact.phones) return null;
  const phones = Object.values(contact.phones);
  // Prefer phone with private context
  const privatePhone = phones.find(p => p.contexts?.private);
  if (privatePhone) return privatePhone.number;
  // Otherwise return first phone
  return phones[0]?.number || null;
}

/**
 * Check if a ContactCard is a group
 */
export function isContactGroup(contact: ContactCard): boolean {
  return contact.kind === 'group';
}

/**
 * Type guard to check if an error is an addressBookHasContents error
 */
export function isAddressBookHasContentsError(error: { type?: string }): boolean {
  return error.type === 'addressBookHasContents';
}
