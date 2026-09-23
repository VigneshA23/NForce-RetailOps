import { useMemo, useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import type { Role } from '../types/auth';
import SearchInput from '../components/SearchInput';
import { matchesSearch } from '../utils/search';
import { getHelpGroupsForRole, type HelpSection } from './helpContent';
import './Help.css';

interface HelpProps {
  role?: Role | null;
}

// Cycled by each section's position within its group, purely for visual
// variety -- not tied to section identity/content, so adding or reordering
// sections in helpContent.ts never needs a matching color assignment here.
const ICON_TONES = ['primary', 'success', 'warning', 'info', 'purple'] as const;
type IconTone = (typeof ICON_TONES)[number];

interface HelpSectionCardProps {
  section: HelpSection;
  tone: IconTone;
  isExpanded: boolean;
  onToggle: () => void;
}

function HelpSectionCard({ section, tone, isExpanded, onToggle }: HelpSectionCardProps) {
  const Icon = section.icon;
  const panelId = `help-panel-${section.id}`;

  return (
    <div className={`help-section${isExpanded ? ' help-section--expanded' : ''}`}>
      <button
        type="button"
        className="help-section__header"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={panelId}
      >
        <span className={`help-section__icon help-section__icon--${tone}`}>
          <Icon size={18} />
        </span>
        <span className="help-section__title">{section.title}</span>
        <ChevronDown size={18} className="help-section__chevron" aria-hidden="true" />
      </button>

      {isExpanded && (
        <div className="help-section__body" id={panelId} role="region">
          <p className="help-section__description">{section.description}</p>

          {section.steps && (
            <ol className="help-section__steps">
              {section.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}

          {section.bullets && (
            <ul className="help-section__bullets">
              {section.bullets.map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>
          )}

          {section.important && section.important.length > 0 && (
            <div className="help-section__important">
              <strong>Important:</strong>
              {section.important.length === 1 ? (
                <span> {section.important[0]}</span>
              ) : (
                <ul>
                  {section.important.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Help({ role }: HelpProps) {
  const groups = useMemo(() => getHelpGroupsForRole(role), [role]);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredGroups = useMemo(() => {
    if (!query.trim()) return groups;
    return groups
      .map((group) => ({
        ...group,
        sections: group.sections.filter((section) =>
          matchesSearch(query, [
            section.title,
            section.description,
            ...(section.bullets ?? []),
            ...(section.steps ?? []),
            ...(section.important ?? []),
          ]),
        ),
      }))
      .filter((group) => group.sections.length > 0);
  }, [groups, query]);

  const hasResults = filteredGroups.length > 0;

  return (
    <div className="help-page">
      <div className="help-page__header">
        <div className="help-page__banner">
          <span className="help-page__banner-glow" aria-hidden="true" />
          <span className="help-page__icon">
            <BookOpen size={22} />
          </span>
          <div className="help-page__banner-text">
            <h2 className="help-page__title">Help &amp; Guidance</h2>
            <p className="help-page__subtitle">
              Find quick answers, guides and resources to help you get the most out of NForce RetailOps.
            </p>
          </div>
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="Search help articles, guides, or topics…" variant="card" />
      </div>

      {!hasResults && (
        <div className="card help-page__empty">No help topics match your search.</div>
      )}

      {filteredGroups.map((group) => (
        <section key={group.id} className="help-group">
          <h3 className="help-group__title">{group.title}</h3>
          <div className="help-group__list">
            {group.sections.map((section, index) => (
              <HelpSectionCard
                key={section.id}
                section={section}
                tone={ICON_TONES[index % ICON_TONES.length]}
                isExpanded={expanded.has(section.id)}
                onToggle={() => toggle(section.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default Help;
