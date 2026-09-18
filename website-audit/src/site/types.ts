// Data contracts shared across the templated build.
//
// The provenance types are the load-bearing ones. Every string the build renders is either traceable
// to a verbatim quote from the audited site, traceable to the audit's own facts extraction, or
// explicitly unverified — and the fabrication gate is only meaningful because that distinction is
// carried in the data rather than assumed.
import { z } from 'zod';

export type BuildProfile = 'mockup' | 'production';

/**
 * Where a piece of copy came from. `kind: 'source'` with a `quote` requires that span to appear
 * verbatim in one of the scraped pages; `kind: 'source'` with no quote is an atomic value the audit
 * extracted itself. `kind: 'placeholder'` means the source said nothing, and the text must therefore
 * carry no specific claim.
 */
export interface Provenance {
  kind: 'source' | 'placeholder';
  page_url: string | null;
  quote: string | null;
}

/** Provenance, flattened into whatever carries it, because a nested object blows up the grammar. */
export const provenanceFields = {
  source_kind: z.enum(['source', 'placeholder']),
  source_page_url: z.string().nullable(),
  source_quote: z.string().nullable(),
};

export const NamedEntitySchema = z.object({ name: z.string(), detail: z.string(), ...provenanceFields });

export const provenanceOf = (v: { source_kind: 'source' | 'placeholder'; source_page_url: string | null; source_quote: string | null }): Provenance => ({
  kind: v.source_kind,
  page_url: v.source_page_url,
  quote: v.source_quote,
});

export interface NamedEntity {
  name: string;
  detail: string;
  source: Provenance;
}

/** The named things the page is entitled to state, which become its structured data and llms.txt. */
export interface Entities {
  services: NamedEntity[];
  areas: NamedEntity[];
  credentials: NamedEntity[];
  /** Only when the source states both a rating value and a review count. */
  rating: { value: string; count: string; source: Provenance } | null;
  price_statements: NamedEntity[];
}

// ---------------------------------------------------------------------------------------------
// Harvested imagery
// ---------------------------------------------------------------------------------------------

export type AssetRole = 'hero' | 'gallery' | 'team' | 'logo' | 'icon';

export interface AssetRecord {
  /** Path relative to the site dir, e.g. 'assets/img/hero-01.webp'. */
  file: string;
  source_url: string;
  alt_from_source: string;
  bytes: number;
  width: number;
  height: number;
  role: AssetRole;
  same_host: boolean;
  /** True when the image was hosted off the audited domain; the client must confirm the licence. */
  verify_license: boolean;
  /**
   * True when the filename looks like a stock-library download. The business may well hold the
   * licence, but a persona that penalises generic stock imagery should not have it reused silently.
   */
  likely_stock: boolean;
}

export interface AssetManifest {
  assets: AssetRecord[];
  skipped: { url: string; reason: string }[];
  harvested: number;
  downloaded: number;
}

// ---------------------------------------------------------------------------------------------
// copy_map.json
// ---------------------------------------------------------------------------------------------

export interface CopyMapEntry {
  copy_id: string;
  page_path: string;
  text_sha256: string;
  /**
   * Where this string came from. `'template'` means it is checked into the page template verbatim —
   * no model wrote it — and it is held to the same fact-only standard as `'placeholder'`, because
   * boilerplate that states a number or a credential would be stating it about a business the
   * template has never seen.
   */
  source: 'placeholder' | 'template' | { url: string; quote: string };
}

export interface CopyMap {
  paragraphs: CopyMapEntry[];
  /** Blocks with no verified source, over all blocks. Reported at handoff, not hidden. */
  placeholder_ratio: number;
}
