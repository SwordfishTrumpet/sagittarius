import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContactsView } from '../ContactsView';
import type { ContactCard, AddressBook } from '../../types/jmap-contacts';

// Mock contacts hooks
const mockUseAddressBooks = vi.fn();
const mockUseContactCards = vi.fn();
const mockUseAddressBookContacts = vi.fn();
const mockUseContactCardActions = vi.fn();
const mockUseContactSearch = vi.fn();
const mockUseHasContactsCapability = vi.fn();

vi.mock('../../hooks/jmap/useContacts', () => ({
  useAddressBooks: (...args: any[]) => mockUseAddressBooks(...args),
  useContactCards: (...args: any[]) => mockUseContactCards(...args),
  useAddressBookContacts: (...args: any[]) => mockUseAddressBookContacts(...args),
  useContactCardActions: (...args: any[]) => mockUseContactCardActions(...args),
  useAddressBookActions: vi.fn(),
  useContactSearch: (...args: any[]) => mockUseContactSearch(...args),
  useHasContactsCapability: (...args: any[]) => mockUseHasContactsCapability(...args),
}));

function createTestAddressBook(overrides: Partial<AddressBook> & { id: string }): AddressBook {
  return {
    ...overrides,
    name: overrides.name || 'Test Book',
    description: null,
    sortOrder: 0,
    isDefault: overrides.isDefault ?? false,
    isSubscribed: true,
    shareWith: null,
    myRights: {
      mayRead: true,
      mayWrite: true,
      mayShare: true,
      mayDelete: true,
    },
  };
}

function createTestContact(overrides: Partial<ContactCard> & { id: string }): ContactCard {
  return {
    ...overrides,
    addressBookIds: overrides.addressBookIds || { [overrides.id]: true },
    name: overrides.name || {
      full: 'John Doe',
      components: [
        { kind: 'given', value: 'John' },
        { kind: 'surname', value: 'Doe' },
      ],
    },
  };
}

function mockQueryResult<T>(data: T, isLoading = false): any {
  return {
    data,
    isLoading,
    isPending: isLoading,
    isError: false,
    error: null,
    isSuccess: true,
    isFetching: false,
    refetch: vi.fn(),
    status: 'success',
    fetchStatus: 'idle',
  };
}

describe('ContactsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseHasContactsCapability.mockReturnValue(true);
    mockUseAddressBooks.mockReturnValue(mockQueryResult([]));
    mockUseContactCards.mockReturnValue(mockQueryResult([]));
    mockUseAddressBookContacts.mockReturnValue(mockQueryResult([]));
    mockUseContactSearch.mockReturnValue(mockQueryResult([]));
    mockUseContactCardActions.mockReturnValue({
      createContactCard: vi.fn(),
      updateContactCard: vi.fn(),
      deleteContactCard: vi.fn(),
      isPending: false,
      error: null,
    });
    // @ts-ignore mock window.confirm
    window.confirm = vi.fn(() => true);
  });

  it('renders nothing when isOpen is false', () => {
    render(<ContactsView isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText('Contacts')).not.toBeInTheDocument();
  });

  it('renders contacts UI when open', () => {
    render(<ContactsView isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Contacts')).toBeInTheDocument();
  });

  it('shows capability missing message when server does not support contacts', () => {
    mockUseHasContactsCapability.mockReturnValue(false);
    render(<ContactsView isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Contacts Not Available')).toBeInTheDocument();
  });

  it('renders address books in sidebar', () => {
    mockUseAddressBooks.mockReturnValue(mockQueryResult([
      createTestAddressBook({ id: 'ab1', name: 'Personal', isDefault: true }),
    ]));

    render(<ContactsView isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('All Contacts')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('renders contact list items', () => {
    mockUseContactCards.mockReturnValue(mockQueryResult([
      createTestContact({ id: 'c1', name: { full: 'Alice Smith', components: [{ kind: 'given', value: 'Alice' }, { kind: 'surname', value: 'Smith' }] } }),
    ]));

    render(<ContactsView isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  it('shows empty state when no contacts', () => {
    render(<ContactsView isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('No contacts yet')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ContactsView isOpen={true} onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: 'Close contacts' });
    await user.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens contact detail when a contact is clicked', async () => {
    const user = userEvent.setup();
    const contact = createTestContact({
      id: 'c1',
      name: { full: 'Bob Builder', components: [{ kind: 'given', value: 'Bob' }, { kind: 'surname', value: 'Builder' }] },
      emails: { email1: { address: 'bob@example.com' } },
    });
    mockUseContactCards.mockReturnValue(mockQueryResult([contact]));

    render(<ContactsView isOpen={true} onClose={vi.fn()} />);

    await user.click(screen.getByText('Bob Builder'));
    expect(screen.getAllByText('bob@example.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('filters contacts via search', async () => {
    const user = userEvent.setup();
    const contact1 = createTestContact({ id: 'c1', name: { full: 'Alice', components: [{ kind: 'given', value: 'Alice' }, { kind: 'surname', value: '' }] } });
    const contact2 = createTestContact({ id: 'c2', name: { full: 'Bob', components: [{ kind: 'given', value: 'Bob' }, { kind: 'surname', value: '' }] } });

    mockUseContactCards.mockReturnValue(mockQueryResult([contact1, contact2]));
    mockUseContactSearch.mockReturnValue(mockQueryResult([contact1]));

    render(<ContactsView isOpen={true} onClose={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText('Search contacts');
    await user.type(searchInput, 'Ali');

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('groups contacts alphabetically', () => {
    mockUseContactCards.mockReturnValue(mockQueryResult([
      createTestContact({ id: 'c1', name: { full: 'Alice', components: [{ kind: 'given', value: 'Alice' }, { kind: 'surname', value: '' }] } }),
      createTestContact({ id: 'c2', name: { full: 'Bob', components: [{ kind: 'given', value: 'Bob' }, { kind: 'surname', value: '' }] } }),
    ]));

    render(<ContactsView isOpen={true} onClose={vi.fn()} />);
    // Group headers and initials may share the same letter text, so use queryAll
    expect(screen.queryAllByText('A').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText('B').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading skeletons', () => {
    mockUseContactCards.mockReturnValue(mockQueryResult([], true));

    render(<ContactsView isOpen={true} onClose={vi.fn()} />);
    // Skeletons render multiple pulse divs; we can test by absence of contact list content
    expect(screen.queryByText('No contacts yet')).not.toBeInTheDocument();
  });

  it('displays correct contact count', () => {
    mockUseContactCards.mockReturnValue(mockQueryResult([
      createTestContact({ id: 'c1', name: { full: 'One', components: [] } }),
      createTestContact({ id: 'c2', name: { full: 'Two', components: [] } }),
    ]));

    render(<ContactsView isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('2 contacts')).toBeInTheDocument();
  });
});
