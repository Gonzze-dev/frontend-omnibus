/**
 * Catalog of the dashboard management sections.
 *
 * Each dashboard card opens a section of this file, and each
 * option of a section is an endpoint of internal/router/admin.go or
 * internal/router/super_admin.go. Keeping the mapping in a single place prevents
 * the screen and the backend from drifting apart.
 */

export type Glyph =
  | 'list'
  | 'search'
  | 'create'
  | 'edit'
  | 'delete'
  | 'promote'
  | 'demote'
  | 'shield'
  | 'send';

export type Tone = 'blue' | 'indigo' | 'crimson' | 'ink' | 'orange';

export interface Option {
  id: string;
  title: string;
  lead: string;
  icon: Glyph;
  tone: Tone;
  /** Endpoint the screen will cover, so the mapping is not lost. */
  endpoint: string;
  /** The endpoint lives in /api/super: only a super admin can use it. */
  superOnly?: boolean;
  /** Screen that resolves the option. */
  route: string;
}

export interface Group {
  id: string;
  title: string;
  options: readonly Option[];
}

export interface Section {
  /** Matches the shortcut id in the dashboard and the route. */
  id: string;
  title: string;
  lead: string;
  /** Header counter. Sections that do not count rows do not have it. */
  summary?: { value: number; label: string; tone: Tone };
  groups: readonly Group[];
}

/**
 * Color criterion, the same in every section: the list and the creation
 * use the card's tone, one-off lookups and editing are
 * blue, and everything destructive is crimson.
 *
 * The counters are sample data, like the dashboard ones, until
 * the count endpoints exist.
 */
export const SECTIONS: readonly Section[] = [];

export function findSection(id: string | null): Section | undefined {
  return SECTIONS.find((s) => s.id === id);
}
