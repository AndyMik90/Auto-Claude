// Note Panel Component
// Shows entity details for selected node - Part 3.5 Note Panel (Detail View)

import { useMindMapStore } from '../../stores/mindMapStore';
import type { MindMapNode } from '../../stores/mindMapStore';
import { useSelectedNode, useConnectedNodes } from '../../hooks/useMindMapData';
import { NODE_TYPE_CONFIG, PRIORITY_COLORS } from './MindMapNode';

// Detail section component
interface DetailSectionProps {
  title: string;
  children: React.ReactNode;
}

function DetailSection({ title, children }: DetailSectionProps) {
  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
        <span className="flex-1 h-px bg-gray-200"></span>
        <span>{title}</span>
        <span className="flex-1 h-px bg-gray-200"></span>
      </div>
      {children}
    </div>
  );
}

// Detail row component
interface DetailRowProps {
  icon: string;
  label: string;
  value: string | number | undefined | null;
  className?: string;
}

function DetailRow({ icon, label, value, className = '' }: DetailRowProps) {
  if (value === undefined || value === null || value === '') return null;

  return (
    <div className={`flex items-start gap-2 text-sm mb-1.5 ${className}`}>
      <span className="text-gray-400 w-4 flex-shrink-0">{icon}</span>
      <span className="text-gray-600 flex-shrink-0">{label}:</span>
      <span className="text-gray-900 font-medium break-words">{value}</span>
    </div>
  );
}

// Connected contact item
interface ContactItemProps {
  node: MindMapNode;
  onClick: (node: MindMapNode) => void;
}

function ContactItem({ node, onClick }: ContactItemProps) {
  return (
    <button
      onClick={() => onClick(node)}
      className="flex items-center gap-2 w-full text-left p-2 rounded hover:bg-gray-50 transition-colors"
    >
      <span className="text-gray-400">{'\uD83D\uDC64'}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">{node.label}</div>
        {node.subtitle && (
          <div className="text-xs text-gray-500 truncate">{node.subtitle}</div>
        )}
      </div>
      {node.tier && (
        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
          T{node.tier}
        </span>
      )}
    </button>
  );
}

// Action button component
interface ActionButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

function ActionButton({ icon, label, onClick, variant = 'secondary' }: ActionButtonProps) {
  const baseStyles = 'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors';
  const variantStyles = variant === 'primary'
    ? 'bg-blue-600 text-white hover:bg-blue-700'
    : 'bg-gray-100 text-gray-700 hover:bg-gray-200';

  return (
    <button onClick={onClick} className={`${baseStyles} ${variantStyles}`}>
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// Job detail view
function JobDetails({ node, connectedNodes }: { node: MindMapNode; connectedNodes: MindMapNode[] }) {
  const metadata = node.metadata as Record<string, string | number> | undefined;

  const contacts = connectedNodes.filter((n) => n.type === 'CONTACT');
  const programs = connectedNodes.filter((n) => n.type === 'PROGRAM');
  const locations = connectedNodes.filter((n) => n.type === 'LOCATION');

  return (
    <>
      {/* BD Score and Priority */}
      <div className="flex items-center gap-4 mb-4">
        {node.bdScore !== undefined && (
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{node.bdScore}</div>
            <div className="text-xs text-gray-500">BD Score</div>
          </div>
        )}
        {node.priority && (
          <div className="flex items-center gap-2">
            <span className="text-lg">{PRIORITY_COLORS[node.priority]?.emoji}</span>
            <span className="text-sm font-medium capitalize text-gray-700">{node.priority}</span>
          </div>
        )}
      </div>

      {/* Details Section */}
      <DetailSection title="Details">
        <DetailRow icon={'\uD83D\uDCCD'} label="Location" value={node.subtitle} />
        <DetailRow icon={'\uD83D\uDD10'} label="Clearance" value={node.clearance} />
        <DetailRow icon={'\uD83D\uDCBC'} label="Type" value={metadata?.job_type as string} />
        <DetailRow icon={'\uD83D\uDCB0'} label="Rate" value={metadata?.rate as string} />
        <DetailRow icon={'\uD83D\uDCC5'} label="Posted" value={metadata?.posted_date as string} />
      </DetailSection>

      {/* Program Section */}
      {programs.length > 0 && (
        <DetailSection title="Program">
          {programs.map((p) => (
            <DetailRow key={p.id} icon={'\uD83D\uDCCB'} label="Program" value={p.label} />
          ))}
        </DetailSection>
      )}

      {/* Key Contacts */}
      {contacts.length > 0 && (
        <DetailSection title="Key Contacts">
          <div className="space-y-1">
            {contacts.slice(0, 5).map((c) => (
              <ContactItem key={c.id} node={c} onClick={() => {}} />
            ))}
            {contacts.length > 5 && (
              <div className="text-xs text-gray-500 mt-2">
                +{contacts.length - 5} more contacts
              </div>
            )}
          </div>
        </DetailSection>
      )}

      {/* BD Formula */}
      <DetailSection title="BD Formula">
        <div className="space-y-3 text-sm">
          <div>
            <div className="font-medium text-gray-700 mb-1">{'\uD83D\uDCDD'} Opener:</div>
            <p className="text-gray-600 italic bg-gray-50 p-2 rounded">
              "Given your work managing {programs[0]?.label || 'this program'} at{' '}
              {locations[0]?.label || node.subtitle}..."
            </p>
          </div>
          <div>
            <div className="font-medium text-gray-700 mb-1">{'\uD83C\uDFAF'} Pain Point:</div>
            <p className="text-gray-600 italic bg-gray-50 p-2 rounded">
              "I understand the program faces staffing challenges..."
            </p>
          </div>
          <div>
            <div className="font-medium text-gray-700 mb-1">{'\uD83D\uDCBC'} PTS Alignment:</div>
            <p className="text-gray-600 italic bg-gray-50 p-2 rounded">
              "PTS has placed {node.clearance} cleared professionals on similar programs..."
            </p>
          </div>
        </div>
      </DetailSection>
    </>
  );
}

// Contact detail view
function ContactDetails({ node, connectedNodes }: { node: MindMapNode; connectedNodes: MindMapNode[] }) {
  const metadata = node.metadata as Record<string, string> | undefined;

  const programs = connectedNodes.filter((n) => n.type === 'PROGRAM');
  const jobs = connectedNodes.filter((n) => n.type === 'JOB');

  return (
    <>
      {/* Tier and Priority */}
      <div className="flex items-center gap-4 mb-4">
        {node.tier && (
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">T{node.tier}</div>
            <div className="text-xs text-gray-500">Contact Tier</div>
          </div>
        )}
        {node.priority && (
          <div className="flex items-center gap-2">
            <span className="text-lg">{PRIORITY_COLORS[node.priority]?.emoji}</span>
            <span className="text-sm font-medium capitalize text-gray-700">{node.priority}</span>
          </div>
        )}
      </div>

      {/* Contact Details */}
      <DetailSection title="Contact Info">
        <DetailRow icon={'\uD83D\uDCBC'} label="Title" value={node.subtitle} />
        <DetailRow icon={'\uD83C\uDFE2'} label="Company" value={metadata?.company} />
        <DetailRow icon={'\uD83D\uDCE7'} label="Email" value={metadata?.email} />
        <DetailRow icon={'\uD83D\uDCDE'} label="Phone" value={metadata?.phone} />
        <DetailRow icon={'\uD83D\uDD17'} label="LinkedIn" value={metadata?.linkedin ? 'View Profile' : undefined} />
      </DetailSection>

      {/* Programs */}
      {programs.length > 0 && (
        <DetailSection title="Programs">
          {programs.map((p) => (
            <div key={p.id} className="flex items-center gap-2 mb-1">
              <span className="text-gray-400">{'\uD83D\uDCCB'}</span>
              <span className="text-sm text-gray-900">{p.label}</span>
            </div>
          ))}
        </DetailSection>
      )}

      {/* Related Jobs */}
      {jobs.length > 0 && (
        <DetailSection title="Hiring For">
          {jobs.slice(0, 3).map((j) => (
            <div key={j.id} className="flex items-center gap-2 mb-1">
              <span className="text-gray-400">{'\uD83C\uDFAF'}</span>
              <span className="text-sm text-gray-900">{j.label}</span>
              {j.bdScore && (
                <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">
                  {j.bdScore}
                </span>
              )}
            </div>
          ))}
        </DetailSection>
      )}
    </>
  );
}

// Program detail view
function ProgramDetails({ node, connectedNodes }: { node: MindMapNode; connectedNodes: MindMapNode[] }) {
  const metadata = node.metadata as Record<string, string | number> | undefined;

  const jobs = connectedNodes.filter((n) => n.type === 'JOB');
  const contacts = connectedNodes.filter((n) => n.type === 'CONTACT');
  const primes = connectedNodes.filter((n) => n.type === 'PRIME');
  const locations = connectedNodes.filter((n) => n.type === 'LOCATION');

  return (
    <>
      {/* Program Stats */}
      <div className="flex items-center gap-4 mb-4">
        {jobs.length > 0 && (
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{jobs.length}</div>
            <div className="text-xs text-gray-500">Active Jobs</div>
          </div>
        )}
        {contacts.length > 0 && (
          <div className="text-center">
            <div className="text-2xl font-bold text-pink-600">{contacts.length}</div>
            <div className="text-xs text-gray-500">Contacts</div>
          </div>
        )}
      </div>

      {/* Program Details */}
      <DetailSection title="Program Info">
        <DetailRow icon={'\uD83C\uDFDB\uFE0F'} label="Agency" value={metadata?.agency as string} />
        <DetailRow icon={'\uD83C\uDFE2'} label="Prime" value={primes[0]?.label} />
        <DetailRow icon={'\uD83D\uDCB0'} label="Value" value={metadata?.contract_value ? `$${metadata.contract_value}` : undefined} />
        <DetailRow icon={'\uD83D\uDCC4'} label="Vehicle" value={metadata?.contract_vehicle as string} />
        <DetailRow icon={'\uD83D\uDCCD'} label="Locations" value={locations.map((l) => l.label).join(', ')} />
      </DetailSection>

      {/* Active Jobs */}
      {jobs.length > 0 && (
        <DetailSection title="Active Jobs">
          {jobs.slice(0, 5).map((j) => (
            <div key={j.id} className="flex items-center gap-2 mb-1.5">
              <span className="text-gray-400">{'\uD83C\uDFAF'}</span>
              <span className="text-sm text-gray-900 flex-1 truncate">{j.label}</span>
              {j.bdScore && (
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 rounded">
                  {j.bdScore}
                </span>
              )}
            </div>
          ))}
          {jobs.length > 5 && (
            <div className="text-xs text-gray-500 mt-2">+{jobs.length - 5} more jobs</div>
          )}
        </DetailSection>
      )}

      {/* Key Contacts */}
      {contacts.length > 0 && (
        <DetailSection title="Key Contacts">
          {contacts.slice(0, 3).map((c) => (
            <ContactItem key={c.id} node={c} onClick={() => {}} />
          ))}
        </DetailSection>
      )}
    </>
  );
}

// Location detail view
function LocationDetails({ connectedNodes }: { node: MindMapNode; connectedNodes: MindMapNode[] }) {
  const jobs = connectedNodes.filter((n) => n.type === 'JOB');
  const contacts = connectedNodes.filter((n) => n.type === 'CONTACT');
  const programs = connectedNodes.filter((n) => n.type === 'PROGRAM');

  return (
    <>
      {/* Location Stats */}
      <div className="flex items-center gap-4 mb-4">
        {programs.length > 0 && (
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{programs.length}</div>
            <div className="text-xs text-gray-500">Programs</div>
          </div>
        )}
        {jobs.length > 0 && (
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{jobs.length}</div>
            <div className="text-xs text-gray-500">Jobs</div>
          </div>
        )}
        {contacts.length > 0 && (
          <div className="text-center">
            <div className="text-2xl font-bold text-pink-600">{contacts.length}</div>
            <div className="text-xs text-gray-500">Contacts</div>
          </div>
        )}
      </div>

      {/* Programs at this location */}
      {programs.length > 0 && (
        <DetailSection title="Programs">
          {programs.map((p) => (
            <div key={p.id} className="flex items-center gap-2 mb-1.5">
              <span className="text-gray-400">{'\uD83D\uDCCB'}</span>
              <span className="text-sm text-gray-900">{p.label}</span>
            </div>
          ))}
        </DetailSection>
      )}

      {/* Jobs at this location */}
      {jobs.length > 0 && (
        <DetailSection title="Active Jobs">
          {jobs.slice(0, 5).map((j) => (
            <div key={j.id} className="flex items-center gap-2 mb-1.5">
              <span className="text-gray-400">{'\uD83C\uDFAF'}</span>
              <span className="text-sm text-gray-900 flex-1 truncate">{j.label}</span>
              {j.bdScore && (
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 rounded">
                  {j.bdScore}
                </span>
              )}
            </div>
          ))}
          {jobs.length > 5 && (
            <div className="text-xs text-gray-500 mt-2">+{jobs.length - 5} more jobs</div>
          )}
        </DetailSection>
      )}

      {/* Contacts at this location */}
      {contacts.length > 0 && (
        <DetailSection title="Key Contacts">
          {contacts.slice(0, 5).map((c) => (
            <ContactItem key={c.id} node={c} onClick={() => {}} />
          ))}
          {contacts.length > 5 && (
            <div className="text-xs text-gray-500 mt-2">+{contacts.length - 5} more contacts</div>
          )}
        </DetailSection>
      )}
    </>
  );
}

// Generic detail view for other node types
function GenericDetails({ node, connectedNodes }: { node: MindMapNode; connectedNodes: MindMapNode[] }) {
  const metadata = node.metadata as Record<string, string | number> | undefined;

  return (
    <>
      {/* Metadata */}
      {metadata && Object.keys(metadata).length > 0 && (
        <DetailSection title="Details">
          {Object.entries(metadata).map(([key, value]) => (
            <DetailRow
              key={key}
              icon={'\uD83D\uDCCB'}
              label={key.replace(/_/g, ' ')}
              value={String(value)}
            />
          ))}
        </DetailSection>
      )}

      {/* Connected Nodes by Type */}
      {connectedNodes.length > 0 && (
        <DetailSection title="Connections">
          <div className="space-y-2">
            {Array.from(new Set(connectedNodes.map((n) => n.type))).map((type) => {
              const nodesOfType = connectedNodes.filter((n) => n.type === type);
              const config = NODE_TYPE_CONFIG[type];
              return (
                <div key={type}>
                  <div className="text-xs font-medium text-gray-500 mb-1">
                    {config.icon} {config.label} ({nodesOfType.length})
                  </div>
                  {nodesOfType.slice(0, 3).map((n) => (
                    <div key={n.id} className="text-sm text-gray-700 ml-4">
                      {n.label}
                    </div>
                  ))}
                  {nodesOfType.length > 3 && (
                    <div className="text-xs text-gray-400 ml-4">
                      +{nodesOfType.length - 3} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DetailSection>
      )}
    </>
  );
}

// Main NotePanel component
export function NotePanel() {
  const setSelectedNode = useMindMapStore((state) => state.setSelectedNode);
  const selectedNode = useSelectedNode();
  const connectedNodes = useConnectedNodes(selectedNode?.id || null);

  if (!selectedNode) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-gray-300 text-5xl mb-4">{'\uD83D\uDCCB'}</div>
        <h3 className="text-gray-600 font-medium mb-2">No Node Selected</h3>
        <p className="text-gray-400 text-sm">
          Click on a node in the graph to view its details
        </p>
      </div>
    );
  }

  const config = NODE_TYPE_CONFIG[selectedNode.type] || NODE_TYPE_CONFIG.JOB;

  // Get type-specific details component
  const renderDetails = () => {
    switch (selectedNode.type) {
      case 'JOB':
        return <JobDetails node={selectedNode} connectedNodes={connectedNodes} />;
      case 'CONTACT':
        return <ContactDetails node={selectedNode} connectedNodes={connectedNodes} />;
      case 'PROGRAM':
        return <ProgramDetails node={selectedNode} connectedNodes={connectedNodes} />;
      case 'LOCATION':
        return <LocationDetails node={selectedNode} connectedNodes={connectedNodes} />;
      default:
        return <GenericDetails node={selectedNode} connectedNodes={connectedNodes} />;
    }
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div
        className="p-4 border-b border-gray-200"
        style={{ background: config.bgGradient }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{config.icon}</span>
          <span
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: config.textColor }}
          >
            {config.label}
          </span>
          <button
            onClick={() => setSelectedNode(null)}
            className="ml-auto text-gray-400 hover:text-gray-600 text-lg"
          >
            {'\u2715'}
          </button>
        </div>
        <h2
          className="text-lg font-semibold leading-tight"
          style={{ color: config.textColor }}
        >
          {selectedNode.label}
        </h2>
        {selectedNode.subtitle && (
          <p className="text-sm text-gray-600 mt-0.5">{selectedNode.subtitle}</p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {renderDetails()}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex flex-wrap gap-2">
          <ActionButton
            icon={'\uD83D\uDCDE'}
            label="Call"
            onClick={() => {}}
            variant="primary"
          />
          <ActionButton
            icon={'\uD83D\uDCE7'}
            label="Email"
            onClick={() => {}}
          />
          <ActionButton
            icon={'\uD83D\uDD17'}
            label="LinkedIn"
            onClick={() => {}}
          />
          <ActionButton
            icon={'\uD83D\uDCCB'}
            label="Copy"
            onClick={() => {}}
          />
        </div>
      </div>
    </div>
  );
}

export default NotePanel;
