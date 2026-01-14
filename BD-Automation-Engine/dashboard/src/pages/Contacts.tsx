import { useState, useMemo, useEffect } from 'react';
import { Search, Mail, Phone, Linkedin, Building2, User, ChevronDown, ChevronRight, Network } from 'lucide-react';
import type { Contact } from '../types';
import { TIER_LABELS, type ContactTier } from '../types';
import type { NativeNodeType } from '../configs/nativeNodeConfigs';

interface ContactsProps {
  contacts: Record<string, Contact[]>;
  loading: boolean;
  initialCompanyFilter?: string;
  onNavigateToProgram?: (programName: string) => void;
  onNavigateToMindMap?: (entityType: NativeNodeType, entityId: string, entityLabel: string) => void;
}

const TIER_COLORS: Record<number, string> = {
  1: 'border-purple-500 bg-purple-50',
  2: 'border-blue-500 bg-blue-50',
  3: 'border-cyan-500 bg-cyan-50',
  4: 'border-emerald-500 bg-emerald-50',
  5: 'border-amber-500 bg-amber-50',
  6: 'border-slate-400 bg-slate-50',
};

const TIER_BADGE_COLORS: Record<number, string> = {
  1: 'bg-purple-600 text-white',
  2: 'bg-blue-600 text-white',
  3: 'bg-cyan-600 text-white',
  4: 'bg-emerald-600 text-white',
  5: 'bg-amber-600 text-white',
  6: 'bg-slate-500 text-white',
};

function ContactCard({
  contact,
  onNavigateToProgram,
  onNavigateToMindMap,
}: {
  contact: Contact;
  onNavigateToProgram?: (programName: string) => void;
  onNavigateToMindMap?: (entityType: NativeNodeType, entityId: string, entityLabel: string) => void;
}) {
  const tierColor = TIER_COLORS[contact.tier] || TIER_COLORS[6];

  return (
    <div className={`bg-white rounded-lg shadow-sm border-l-4 ${tierColor} p-4 hover:shadow-md transition-shadow`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
          <User className="h-5 w-5 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 truncate">
            {contact.name || `${contact.first_name || ''} (No Name)`.trim()}
          </h3>
          {contact.title && (
            <p className="text-sm text-slate-600 truncate">{contact.title}</p>
          )}
          {contact.company && (
            <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
              <Building2 className="h-3.5 w-3.5" />
              <span className="truncate">{contact.company}</span>
            </p>
          )}
        </div>
        {onNavigateToMindMap && (
          <button
            onClick={() => onNavigateToMindMap('CONTACT', contact.id, contact.name || contact.first_name || 'Contact')}
            className="flex-shrink-0 p-1.5 text-slate-400 hover:text-purple-600 transition-colors rounded hover:bg-purple-50"
            title="Explore in Mind Map"
          >
            <Network className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-2 truncate"
          >
            <Mail className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{contact.email}</span>
          </a>
        )}
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className="text-sm text-slate-600 hover:text-slate-800 flex items-center gap-2"
          >
            <Phone className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{contact.phone}</span>
          </a>
        )}
        {contact.linkedin && (
          <a
            href={contact.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-2"
          >
            <Linkedin className="h-3.5 w-3.5 flex-shrink-0" />
            <span>LinkedIn Profile</span>
          </a>
        )}
      </div>

      {(contact.program || contact.relationship_status) && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
          {contact.program && (
            <button
              onClick={() => onNavigateToProgram?.(contact.program)}
              className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
              title="View program details"
            >
              {contact.program}
            </button>
          )}
          {contact.relationship_status && (
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              {contact.relationship_status}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function TierSection({
  tier,
  contacts,
  searchQuery,
  defaultExpanded = false,
  onNavigateToProgram,
  onNavigateToMindMap,
}: {
  tier: number;
  contacts: Contact[];
  searchQuery: string;
  defaultExpanded?: boolean;
  onNavigateToProgram?: (programName: string) => void;
  onNavigateToMindMap?: (entityType: NativeNodeType, entityId: string, entityLabel: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name?.toLowerCase().includes(query) ||
        c.first_name?.toLowerCase().includes(query) ||
        c.title?.toLowerCase().includes(query) ||
        c.company?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.program?.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  if (filteredContacts.length === 0) return null;

  const tierLabel = TIER_LABELS[tier as ContactTier] || `Tier ${tier}`;
  const badgeColor = TIER_BADGE_COLORS[tier] || TIER_BADGE_COLORS[6];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-slate-400" />
          )}
          <span className={`text-xs font-bold px-2 py-1 rounded ${badgeColor}`}>
            Tier {tier}
          </span>
          <span className="font-semibold text-slate-900">{tierLabel}</span>
        </div>
        <span className="text-sm text-slate-500">{filteredContacts.length} contacts</span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredContacts.slice(0, 50).map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onNavigateToProgram={onNavigateToProgram}
                onNavigateToMindMap={onNavigateToMindMap}
              />
            ))}
          </div>
          {filteredContacts.length > 50 && (
            <p className="mt-4 text-center text-sm text-slate-500">
              Showing 50 of {filteredContacts.length} contacts
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function Contacts({
  contacts,
  loading,
  initialCompanyFilter,
  onNavigateToProgram,
  onNavigateToMindMap,
}: ContactsProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Apply initial filter from cross-navigation
  useEffect(() => {
    if (initialCompanyFilter) {
      setSearchQuery(initialCompanyFilter);
    }
  }, [initialCompanyFilter]);

  // Get total contact count
  const totalContacts = useMemo(() => {
    return Object.values(contacts).reduce((sum, arr) => sum + arr.length, 0);
  }, [contacts]);

  // Get sorted tiers
  const sortedTiers = useMemo(() => {
    return Object.keys(contacts)
      .map(Number)
      .sort((a, b) => a - b);
  }, [contacts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Contact Intelligence</h1>
        <p className="text-slate-500">{totalContacts} total contacts organized by hierarchy tier</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search contacts by name, title, company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Tier Legend */}
      <div className="mb-6 flex flex-wrap gap-2">
        {sortedTiers.map((tier) => {
          const count = contacts[tier]?.length || 0;
          const badgeColor = TIER_BADGE_COLORS[tier] || TIER_BADGE_COLORS[6];
          return (
            <span key={tier} className={`text-xs font-medium px-2 py-1 rounded ${badgeColor}`}>
              Tier {tier}: {count}
            </span>
          );
        })}
      </div>

      {/* Tier Sections */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {sortedTiers.map((tier) => (
          <TierSection
            key={tier}
            tier={tier}
            contacts={contacts[tier] || []}
            searchQuery={searchQuery}
            defaultExpanded={tier === 1}
            onNavigateToProgram={onNavigateToProgram}
            onNavigateToMindMap={onNavigateToMindMap}
          />
        ))}
      </div>
    </div>
  );
}
