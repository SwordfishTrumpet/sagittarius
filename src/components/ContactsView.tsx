/**
 * ContactsView — Full contacts UI component for RFC 9610 JMAP Contacts
 * 
 * Features:
 * - Contact list with search and filtering
 * - Contact detail view with all JSContact fields
 * - Create, edit, delete contacts
 * - Address book sidebar for organization
 * - iCloud-style glassmorphic design
 */

import { useState, useMemo, useCallback } from 'react';
import {
  User,
  Users,
  X,
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  Building2,
  Trash2,
  Edit2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import {
  useAddressBooks,
  useContactCards,
  useAddressBookContacts,
  useContactCardActions,
  useAddressBookActions,
  useContactSearch,
  useHasContactsCapability,
} from '../hooks/jmap/useContacts';
import {
  getContactFullName,
  getContactPrimaryEmail,
  getContactPrimaryPhone,
  type ContactCard,
  type AddressBook,
} from '../types/jmap-contacts';
import { Card, Skeleton } from './ui/Card';
import { BaseDialog } from './dialogs/BaseDialog';

interface ContactsViewProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ContactFormData {
  givenName: string;
  surname: string;
  email: string;
  phone: string;
  organization: string;
  address: string;
  notes: string;
  addressBookId: string;
}

const DEFAULT_CONTACT_FORM: ContactFormData = {
  givenName: '',
  surname: '',
  email: '',
  phone: '',
  organization: '',
  address: '',
  notes: '',
  addressBookId: '',
};

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function AddressBookSidebar({
  addressBooks,
  selectedAddressBookId,
  onSelectAddressBook,
  isLoading,
}: {
  addressBooks: AddressBook[];
  selectedAddressBookId: string | null;
  onSelectAddressBook: (id: string | null) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton count={3} />;
  }

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => onSelectAddressBook(null)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
          selectedAddressBookId === null
            ? 'bg-[#007AFF] text-white'
            : 'hover:bg-black/5 text-[#1C1C1E]'
        }`}
      >
        <Users className="w-[18px] h-[18px]" strokeWidth={1.5} />
        <span className="text-[14px] font-medium">All Contacts</span>
      </button>
      {addressBooks.map((ab) => (
        <button
          key={ab.id}
          onClick={() => onSelectAddressBook(ab.id)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
            selectedAddressBookId === ab.id
              ? 'bg-[#007AFF] text-white'
              : 'hover:bg-black/5 text-[#1C1C1E]'
          }`}
        >
          <User className="w-[18px] h-[18px]" strokeWidth={1.5} />
          <span className="text-[14px] truncate">{ab.name}</span>
          {ab.isDefault && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              selectedAddressBookId === ab.id ? 'bg-white/20' : 'bg-[#007AFF]/10 text-[#007AFF]'
            }`}>
              Default
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function ContactListItem({
  contact,
  isSelected,
  onClick,
}: {
  contact: ContactCard;
  isSelected: boolean;
  onClick: () => void;
}) {
  const name = getContactFullName(contact);
  const email = getContactPrimaryEmail(contact);
  const initials = getInitials(name);

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
        isSelected ? 'bg-[#007AFF] text-white' : 'hover:bg-black/5'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-semibold shrink-0 ${
          isSelected ? 'bg-white/20 text-white' : 'bg-[#E5E5EA] text-[#8E8E93]'
        }`}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className={`text-[14px] font-medium truncate ${isSelected ? 'text-white' : 'text-[#1C1C1E]'}`}>
          {name}
        </p>
        {email && (
          <p className={`text-[12px] truncate ${isSelected ? 'text-white/70' : 'text-[#8E8E93]'}`}>
            {email}
          </p>
        )}
      </div>
      <ChevronRight
        className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white/50' : 'text-[#C7C7CC]'}`}
        strokeWidth={1.5}
      />
    </button>
  );
}

function ContactDetail({
  contact,
  onEdit,
  onDelete,
}: {
  contact: ContactCard;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const name = getContactFullName(contact);
  const initials = getInitials(name);
  const emails = contact.emails ? Object.values(contact.emails) : [];
  const phones = contact.phones ? Object.values(contact.phones) : [];
  const addresses = contact.addresses ? Object.values(contact.addresses) : [];
  const organizations = contact.organizations ? Object.values(contact.organizations) : [];
  const notes = contact.notes ? Object.values(contact.notes) : [];

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="text-center p-8 border-b border-[#E5E5EA]">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center text-[32px] font-bold text-white mx-auto mb-4 shadow-lg">
          {initials}
        </div>
        <h2 className="text-[22px] font-semibold text-[#1C1C1E]">{name}</h2>
        {organizations.length > 0 && (
          <p className="text-[15px] text-[#8E8E93] mt-1">{organizations[0].name}</p>
        )}
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 text-[14px] font-medium text-[#007AFF] hover:bg-[#007AFF]/10 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" strokeWidth={1.5} />
            Edit
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-4 py-2 text-[14px] font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
            Delete
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="p-6 space-y-6">
        {/* Emails */}
        {emails.length > 0 && (
          <div>
            <h3 className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-2">
              Email
            </h3>
            <Card dividers>
              {emails.map((email, idx) => (
                <a
                  key={idx}
                  href={`mailto:${email.address}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-black/5 transition-colors"
                >
                  <Mail className="w-5 h-5 text-[#007AFF]" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-[#007AFF] truncate">{email.address}</p>
                    {email.label && (
                      <p className="text-[12px] text-[#8E8E93]">{email.label}</p>
                    )}
                  </div>
                </a>
              ))}
            </Card>
          </div>
        )}

        {/* Phones */}
        {phones.length > 0 && (
          <div>
            <h3 className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-2">
              Phone
            </h3>
            <Card dividers>
              {phones.map((phone, idx) => (
                <a
                  key={idx}
                  href={`tel:${phone.number}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-black/5 transition-colors"
                >
                  <Phone className="w-5 h-5 text-[#34C759]" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-[#007AFF] truncate">{phone.number}</p>
                    {phone.label && (
                      <p className="text-[12px] text-[#8E8E93]">{phone.label}</p>
                    )}
                  </div>
                </a>
              ))}
            </Card>
          </div>
        )}

        {/* Addresses */}
        {addresses.length > 0 && (
          <div>
            <h3 className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-2">
              Address
            </h3>
            <Card dividers>
              {addresses.map((addr, idx) => {
                const fullAddr = addr.full || addr.components?.map(c => c.value).join(', ') || '';
                return (
                  <div key={idx} className="flex items-start gap-3 px-4 py-3">
                    <MapPin className="w-5 h-5 text-[#FF9500] shrink-0 mt-0.5" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] text-[#1C1C1E] whitespace-pre-line">{fullAddr}</p>
                      {addr.label && (
                        <p className="text-[12px] text-[#8E8E93] mt-0.5">{addr.label}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        )}

        {/* Notes */}
        {notes.length > 0 && (
          <div>
            <h3 className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-2">
              Notes
            </h3>
            <Card padding="medium">
              {notes.map((note, idx) => (
                <p key={idx} className="text-[14px] text-[#1C1C1E] whitespace-pre-wrap">
                  {note.note}
                </p>
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function ContactFormDialog({
  isOpen,
  onClose,
  contact,
  addressBooks,
  onSave,
  isPending,
}: {
  isOpen: boolean;
  onClose: () => void;
  contact: ContactCard | null;
  addressBooks: AddressBook[];
  onSave: (data: ContactFormData, contactId?: string) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<ContactFormData>(DEFAULT_CONTACT_FORM);

  // Initialize form when contact changes
  useMemo(() => {
    if (contact) {
      const givenName = contact.name?.components?.find(c => c.kind === 'given')?.value || '';
      const surname = contact.name?.components?.find(c => c.kind === 'surname')?.value || '';
      const email = getContactPrimaryEmail(contact) || '';
      const phone = getContactPrimaryPhone(contact) || '';
      const org = contact.organizations ? Object.values(contact.organizations)[0]?.name : '';
      const addr = contact.addresses ? Object.values(contact.addresses)[0]?.full : '';
      const notes = contact.notes ? Object.values(contact.notes)[0]?.note : '';
      const addressBookId = Object.keys(contact.addressBookIds)[0] || addressBooks[0]?.id || '';

      setForm({
        givenName,
        surname,
        email,
        phone,
        organization: org || '',
        address: addr || '',
        notes: notes || '',
        addressBookId,
      });
    } else {
      setForm({
        ...DEFAULT_CONTACT_FORM,
        addressBookId: addressBooks.find(ab => ab.isDefault)?.id || addressBooks[0]?.id || '',
      });
    }
  }, [contact, addressBooks]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form, contact?.id);
  };

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={onClose}
      title={contact ? 'Edit Contact' : 'New Contact'}
      titleId="contact-form-dialog-title"
    >
      <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[70vh] overflow-auto">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">
              First Name
            </label>
            <input
              type="text"
              value={form.givenName}
              onChange={(e) => setForm({ ...form, givenName: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E5EA] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
              placeholder="John"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={form.surname}
              onChange={(e) => setForm({ ...form, surname: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5E5EA] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
              placeholder="Appleseed"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">
            Address Book
          </label>
          <select
            value={form.addressBookId}
            onChange={(e) => setForm({ ...form, addressBookId: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-[#E5E5EA] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#007AFF] bg-white"
            required
          >
            {addressBooks.map((ab) => (
              <option key={ab.id} value={ab.id}>
                {ab.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-[#E5E5EA] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
            placeholder="john@example.com"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">
            Phone
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-[#E5E5EA] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
            placeholder="+1 (555) 123-4567"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">
            Company
          </label>
          <input
            type="text"
            value={form.organization}
            onChange={(e) => setForm({ ...form, organization: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-[#E5E5EA] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
            placeholder="Acme Inc."
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">
            Address
          </label>
          <textarea
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-[#E5E5EA] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#007AFF] resize-none"
            rows={2}
            placeholder="123 Main St, City, State"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">
            Notes
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-[#E5E5EA] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#007AFF] resize-none"
            rows={3}
            placeholder="Additional notes..."
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[14px] font-medium text-[#8E8E93] hover:bg-black/5 rounded-lg transition-colors"
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-[14px] font-medium text-white bg-[#007AFF] hover:bg-[#0066DD] rounded-lg transition-colors disabled:opacity-50"
            disabled={isPending || (!form.givenName && !form.surname)}
          >
            {isPending ? 'Saving...' : contact ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </BaseDialog>
  );
}

export function ContactsView({ isOpen, onClose }: ContactsViewProps) {
  const hasCapability = useHasContactsCapability();
  const { data: addressBooks = [], isLoading: addressBooksLoading } = useAddressBooks();
  const { data: allContacts = [], isLoading: contactsLoading } = useContactCards();
  const { createContactCard, updateContactCard, deleteContactCard, isPending } = useContactCardActions();

  const [selectedAddressBookId, setSelectedAddressBookId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingContact, setEditingContact] = useState<ContactCard | null>(null);
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);

  // Get contacts for selected address book
  const { data: addressBookContacts = [] } = useAddressBookContacts(selectedAddressBookId);

  // Search contacts
  const { data: searchResults = [] } = useContactSearch(searchTerm);

  // Determine which contacts to show
  const displayedContacts = useMemo(() => {
    if (searchTerm.length > 0) {
      return searchResults;
    }
    if (selectedAddressBookId) {
      return addressBookContacts;
    }
    return allContacts;
  }, [searchTerm, searchResults, selectedAddressBookId, addressBookContacts, allContacts]);

  // Sort contacts alphabetically
  const sortedContacts = useMemo(() => {
    return [...displayedContacts].sort((a, b) => {
      const nameA = getContactFullName(a).toLowerCase();
      const nameB = getContactFullName(b).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [displayedContacts]);

  // Group contacts by first letter
  const groupedContacts = useMemo(() => {
    const groups: Record<string, ContactCard[]> = {};
    sortedContacts.forEach((contact) => {
      const name = getContactFullName(contact);
      const firstLetter = name.charAt(0).toUpperCase() || '#';
      if (!groups[firstLetter]) groups[firstLetter] = [];
      groups[firstLetter].push(contact);
    });
    return groups;
  }, [sortedContacts]);

  const selectedContact = useMemo(
    () => allContacts.find((c) => c.id === selectedContactId) || null,
    [allContacts, selectedContactId]
  );

  const handleDeleteContact = useCallback(
    async (contactId: string) => {
      if (confirm('Are you sure you want to delete this contact?')) {
        await deleteContactCard(contactId);
        setSelectedContactId(null);
      }
    },
    [deleteContactCard]
  );

  const handleSaveContact = useCallback(
    async (data: ContactFormData, contactId?: string) => {
      const contactCard: Omit<ContactCard, 'id'> = {
        addressBookIds: { [data.addressBookId]: true },
        name: {
          components: [
            ...(data.givenName ? [{ kind: 'given', value: data.givenName }] : []),
            ...(data.surname ? [{ kind: 'surname', value: data.surname }] : []),
          ],
          full: [data.givenName, data.surname].filter(Boolean).join(' '),
        },
      };

      if (data.email) {
        contactCard.emails = {
          email1: { address: data.email },
        };
      }

      if (data.phone) {
        contactCard.phones = {
          phone1: { number: data.phone },
        };
      }

      if (data.organization) {
        contactCard.organizations = {
          org1: { name: data.organization },
        };
      }

      if (data.address) {
        contactCard.addresses = {
          addr1: { full: data.address, components: [] },
        };
      }

      if (data.notes) {
        contactCard.notes = {
          note1: { note: data.notes },
        };
      }

      if (contactId) {
        await updateContactCard(contactId, contactCard);
      } else {
        await createContactCard(contactCard);
      }

      setIsContactFormOpen(false);
      setEditingContact(null);
    },
    [createContactCard, updateContactCard]
  );

  if (!isOpen) return null;

  if (!hasCapability) {
    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-[#E5E5E5] max-w-md w-full mx-4 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-[#FF9500] mx-auto mb-4" strokeWidth={1.5} />
          <h2 className="text-[17px] font-bold text-[#1C1C1E] mb-2">Contacts Not Available</h2>
          <p className="text-[14px] text-[#8E8E93] mb-6">
            Your JMAP server does not support the Contacts capability (RFC 9610).
            Contact your server administrator for more information.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 text-[14px] font-medium text-white bg-[#007AFF] hover:bg-[#0066DD] rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const isLoading = addressBooksLoading || contactsLoading;

  return (
    <div className="fixed inset-0 z-[10000] flex bg-[#F2F2F7]">
      {/* Sidebar */}
      <aside className="w-64 bg-white/70 backdrop-blur-xl border-r border-[#E5E5E5] flex flex-col">
        <header className="px-4 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h1 className="text-[17px] font-bold text-[#1C1C1E]">Contacts</h1>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-black/5 rounded-lg transition-colors"
            aria-label="Close contacts"
          >
            <X className="w-5 h-5 text-[#8E8E93]" strokeWidth={1.5} />
          </button>
        </header>

        {/* Address books */}
        <div className="flex-1 overflow-auto p-4">
          <h2 className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-2">
            Address Books
          </h2>
          <AddressBookSidebar
            addressBooks={addressBooks}
            selectedAddressBookId={selectedAddressBookId}
            onSelectAddressBook={setSelectedAddressBookId}
            isLoading={addressBooksLoading}
          />
        </div>

        {/* Add contact button */}
        <div className="p-4 border-t border-[#E5E5E5]">
          <button
            onClick={() => {
              setEditingContact(null);
              setIsContactFormOpen(true);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[14px] font-medium text-white bg-[#007AFF] hover:bg-[#0066DD] rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            New Contact
          </button>
        </div>
      </aside>

      {/* Contact list */}
      <div className="w-80 bg-white/50 backdrop-blur-xl border-r border-[#E5E5E5] flex flex-col">
        {/* Search */}
        <div className="p-3 border-b border-[#E5E5E5]">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E8E93]"
              strokeWidth={1.5}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search contacts"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#F2F2F7] text-[14px] placeholder-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
            />
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4">
              <Skeleton count={5} />
            </div>
          ) : sortedContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <User className="w-12 h-12 text-[#C7C7CC] mb-3" strokeWidth={1} />
              <p className="text-[15px] text-[#8E8E93]">
                {searchTerm ? 'No contacts found' : 'No contacts yet'}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => {
                    setEditingContact(null);
                    setIsContactFormOpen(true);
                  }}
                  className="text-[14px] text-[#007AFF] font-medium mt-2 hover:underline"
                >
                  Add your first contact
                </button>
              )}
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(groupedContacts).map(([letter, contacts]) => (
                <div key={letter}>
                  <div className="px-4 py-1 text-[12px] font-semibold text-[#8E8E93] bg-[#F2F2F7] sticky top-0">
                    {letter}
                  </div>
                  <div className="px-2">
                    {contacts.map((contact) => (
                      <ContactListItem
                        key={contact.id}
                        contact={contact}
                        isSelected={selectedContactId === contact.id}
                        onClick={() => setSelectedContactId(contact.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact count */}
        <div className="px-4 py-2 border-t border-[#E5E5E5] text-center">
          <span className="text-[12px] text-[#8E8E93]">
            {sortedContacts.length} {sortedContacts.length === 1 ? 'contact' : 'contacts'}
          </span>
        </div>
      </div>

      {/* Contact detail */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white">
        {selectedContact ? (
          <ContactDetail
            contact={selectedContact}
            onEdit={() => {
              setEditingContact(selectedContact);
              setIsContactFormOpen(true);
            }}
            onDelete={() => handleDeleteContact(selectedContact.id)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 rounded-full bg-[#F2F2F7] flex items-center justify-center mb-4">
              <User className="w-10 h-10 text-[#C7C7CC]" strokeWidth={1} />
            </div>
            <p className="text-[17px] text-[#8E8E93]">Select a contact to view details</p>
          </div>
        )}
      </main>

      {/* Contact form dialog */}
      <ContactFormDialog
        isOpen={isContactFormOpen}
        onClose={() => {
          setIsContactFormOpen(false);
          setEditingContact(null);
        }}
        contact={editingContact}
        addressBooks={addressBooks}
        onSave={handleSaveContact}
        isPending={isPending}
      />
    </div>
  );
}
