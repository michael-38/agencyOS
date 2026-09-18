// SiteRedesign data contracts.
//
// Two shapes live here on purpose. The `*Schema` exports are what the model returns, and they are
// deliberately shallow and flat — a nested provenance object inside a block inside a section inside
// a page compiles to a structured-output grammar the API rejects as too large. The interfaces below
// them are the internal shape the rest of the build uses, with provenance nested where it reads
// naturally. `toSitePlan` converts one into the other.
import { z } from 'zod';

// ---------------------------------------------------------------------------------------------
// Internal shapes
// ---------------------------------------------------------------------------------------------

/**
 * Where a piece of copy came from. `kind: 'source'` requires a verbatim `quote` from one of the
 * scraped pages; `kind: 'placeholder'` means the model had nothing to work from and the text must
 * carry no specific claim. The fabrication gate in validate.ts enforces both halves.
 */
export interface Provenance {
  kind: 'source' | 'placeholder';
  page_url: string | null;
  quote: string | null;
}

export interface CopyBlock {
  kind: 'paragraph' | 'bullet' | 'stat' | 'quote';
  text: string;
  source: Provenance;
}

export interface Cta {
  label: string;
  /** 'tel' → the business phone; 'anchor' → an id on the same page; 'page' → a generated path. */
  kind: 'tel' | 'anchor' | 'page' | 'form';
  target: string;
}

export interface FaqEntry {
  q: string;
  a: string;
  source: Provenance;
}

export type ImageSlot = 'hero' | 'gallery' | 'team' | 'logo' | 'none';

export interface PlanSection {
  /** Stable slug, unique within its page; becomes the section id and anchor target. */
  id: string;
  h2: string;
  /** The first sentence rendered in the section. Must answer the h2 on its own (C-answer-first). */
  answer_first_opener: CopyBlock;
  blocks: CopyBlock[];
  cta: Cta | null;
  /** Which harvested image role this section wants, if any. */
  image_slot: ImageSlot;
  /** Audit item ids this section is responsible for satisfying (data-checklist targets). */
  checklist_ids: string[];
}

export type PageKind = 'home' | 'service' | 'area' | 'faq' | 'about' | 'contact';

export interface PlanPage {
  /** Site-root-relative, always starts and ends with '/' except the root itself ('/'). */
  path: string;
  kind: PageKind;
  title: string;
  meta_description: string;
  /** The search/assistant query this page is the best answer to. Drives headings and FAQ. */
  primary_query: string;
  h1: string;
  /** Crumb labels from home to here, excluding home. Empty on the home page. */
  breadcrumb: string[];
  sections: PlanSection[];
  faq: FaqEntry[];
  /** Set on kind 'service' / 'area' so JSON-LD can emit a Service or areaServed node. */
  entity_name: string | null;
}

export interface NamedEntity {
  name: string;
  detail: string;
  source: Provenance;
}

export interface Entities {
  services: NamedEntity[];
  areas: NamedEntity[];
  credentials: NamedEntity[];
  /** Only when the source states both a rating value and a review count. */
  rating: { value: string; count: string; source: Provenance } | null;
  price_statements: NamedEntity[];
}

export interface InternalLink {
  from_path: string;
  to_path: string;
  anchor_text: string;
}

/**
 * A page the architecture pass planned but this build did not write, because `--preview` limited the
 * build to the home page. It is carried in the plan so the home page can still show the real site's
 * navigation — a one-item nav would make a preview look like a one-page site, which undersells it —
 * and so the acceptance build knows what it still owes.
 */
export interface DeferredPage {
  path: string;
  /** The nav label the page would have had. */
  label: string;
  title: string;
  /** Audit item ids the architecture assigned to this page, which no built page has to satisfy. */
  checklist_ids: string[];
}

export interface SitePlan {
  business_name: string;
  /** One sentence for llms.txt and the OG description fallback. */
  site_summary: string;
  pages: PlanPage[];
  entities: Entities;
  internal_links: InternalLink[];
  /** Planned but not written by this build; empty unless `--preview` was used. */
  deferred_pages: DeferredPage[];
  /** Anything the model could not source, in its own words. Surfaced in seo-report.md. */
  notes: string[];
}

// ---------------------------------------------------------------------------------------------
// Model-facing schemas (flat; see the note at the top of the file)
// ---------------------------------------------------------------------------------------------

const SourceKind = z.enum(['source', 'placeholder']);

/** Provenance, flattened into whatever carries it. */
const provenanceFields = {
  source_kind: SourceKind,
  source_page_url: z.string().nullable(),
  source_quote: z.string().nullable(),
};

export const SectionBriefSchema = z.object({
  id: z.string(),
  h2: z.string(),
  /** One sentence saying what this section has to accomplish, for the content pass. */
  intent: z.string(),
  image_slot: z.enum(['hero', 'gallery', 'team', 'logo', 'none']),
  checklist_ids: z.array(z.string()),
});

export const ArchitecturePageSchema = z.object({
  path: z.string(),
  kind: z.enum(['home', 'service', 'area', 'faq', 'about', 'contact']),
  title: z.string(),
  meta_description: z.string(),
  primary_query: z.string(),
  h1: z.string(),
  breadcrumb: z.array(z.string()),
  entity_name: z.string().nullable(),
  sections: z.array(SectionBriefSchema),
});

export const NamedEntitySchema = z.object({ name: z.string(), detail: z.string(), ...provenanceFields });

export const SiteArchitectureSchema = z.object({
  business_name: z.string(),
  site_summary: z.string(),
  pages: z.array(ArchitecturePageSchema),
  services: z.array(NamedEntitySchema),
  areas: z.array(NamedEntitySchema),
  credentials: z.array(NamedEntitySchema),
  price_statements: z.array(NamedEntitySchema),
  /** Emit only when the source states both a value and a count; otherwise leave every field null. */
  rating_value: z.string().nullable(),
  rating_count: z.string().nullable(),
  rating_page_url: z.string().nullable(),
  rating_quote: z.string().nullable(),
  internal_links: z.array(z.object({ from_path: z.string(), to_path: z.string(), anchor_text: z.string() })),
  notes: z.array(z.string()),
});
export type SiteArchitecture = z.infer<typeof SiteArchitectureSchema>;

export const ContentBlockSchema = z.object({
  kind: z.enum(['paragraph', 'bullet', 'stat', 'quote']),
  text: z.string(),
  ...provenanceFields,
});

export const ContentSectionSchema = z.object({
  id: z.string(),
  h2: z.string(),
  opener: ContentBlockSchema,
  blocks: z.array(ContentBlockSchema),
  cta_label: z.string().nullable(),
  cta_kind: z.enum(['tel', 'anchor', 'page', 'form', 'none']),
  cta_target: z.string().nullable(),
});

export const PageContentSchema = z.object({
  sections: z.array(ContentSectionSchema),
  faq: z.array(z.object({ q: z.string(), a: z.string(), ...provenanceFields })),
  notes: z.array(z.string()),
});
export type PageContent = z.infer<typeof PageContentSchema>;

// ---------------------------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------------------------

interface Flat {
  source_kind: 'source' | 'placeholder';
  source_page_url: string | null;
  source_quote: string | null;
}

export function provenanceOf(f: Flat): Provenance {
  return { kind: f.source_kind, page_url: f.source_page_url, quote: f.source_quote };
}

function ctaOf(s: z.infer<typeof ContentSectionSchema>): Cta | null {
  if (s.cta_kind === 'none' || !s.cta_label) return null;
  return { label: s.cta_label, kind: s.cta_kind, target: s.cta_target ?? '' };
}

/** Stitch the architecture pass and the per-page content passes into one plan. */
export function toSitePlan(arch: SiteArchitecture, contents: Map<string, PageContent>): SitePlan {
  // A page with no recorded content was deliberately deferred (`--preview`) or its copy call came
  // back empty; either way it is not part of this build's page set, so it must not reach the
  // renderer, the sitemap, or the validator as a page that was "not written".
  const built = arch.pages.filter((p) => contents.has(p.path));
  const deferred_pages: DeferredPage[] = arch.pages
    .filter((p) => !contents.has(p.path))
    .map((p) => ({
      path: p.path,
      label: p.entity_name ?? p.breadcrumb[p.breadcrumb.length - 1] ?? p.h1,
      title: p.title,
      checklist_ids: p.sections.flatMap((s) => s.checklist_ids),
    }));
  const builtPaths = new Set(built.map((p) => p.path));
  const pages: PlanPage[] = built.map((p) => {
    const content = contents.get(p.path);
    const briefs = new Map(p.sections.map((s) => [s.id, s]));
    const sections: PlanSection[] = (content?.sections ?? []).map((s) => {
      const brief = briefs.get(s.id);
      return {
        id: s.id,
        h2: s.h2,
        answer_first_opener: { kind: s.opener.kind, text: s.opener.text, source: provenanceOf(s.opener) },
        blocks: s.blocks.map((b) => ({ kind: b.kind, text: b.text, source: provenanceOf(b) })),
        cta: ctaOf(s),
        image_slot: brief?.image_slot ?? 'none',
        checklist_ids: brief?.checklist_ids ?? [],
      };
    });
    return {
      path: p.path,
      kind: p.kind,
      title: p.title,
      meta_description: p.meta_description,
      primary_query: p.primary_query,
      h1: p.h1,
      breadcrumb: p.breadcrumb,
      entity_name: p.entity_name,
      sections,
      faq: (content?.faq ?? []).map((f) => ({ q: f.q, a: f.a, source: provenanceOf(f) })),
    };
  });
  const entity = (e: z.infer<typeof NamedEntitySchema>): NamedEntity => ({ name: e.name, detail: e.detail, source: provenanceOf(e) });
  return {
    business_name: arch.business_name,
    site_summary: arch.site_summary,
    pages,
    entities: {
      services: arch.services.map(entity),
      areas: arch.areas.map(entity),
      credentials: arch.credentials.map(entity),
      price_statements: arch.price_statements.map(entity),
      rating:
        arch.rating_value && arch.rating_count
          ? {
              value: arch.rating_value,
              count: arch.rating_count,
              source: { kind: arch.rating_quote ? 'source' : 'placeholder', page_url: arch.rating_page_url, quote: arch.rating_quote },
            }
          : null,
    },
    internal_links: arch.internal_links.filter((l) => builtPaths.has(l.from_path) && builtPaths.has(l.to_path)),
    deferred_pages,
    notes: [...arch.notes, ...[...contents.values()].flatMap((c) => c.notes)],
  };
}

// ---------------------------------------------------------------------------------------------
// Design (stage C)
// ---------------------------------------------------------------------------------------------

export const DesignSpecSchema = z.object({
  /** The complete stylesheet for every page. Written to assets/site.css. */
  css: z.string(),
  /** Markdown: the class contract the render stage must use, plus the rationale. */
  design_md: z.string(),
  /** `<meta name="theme-color">`. */
  theme_color: z.string(),
  /** Short label for the direction, e.g. "quiet editorial". Reported, not rendered. */
  direction: z.string(),
});
export type DesignSpec = z.infer<typeof DesignSpecSchema>;

// ---------------------------------------------------------------------------------------------
// Render (stage D)
// ---------------------------------------------------------------------------------------------

export const RenderedPageSchema = z.object({
  /** Everything that goes inside <main>, including the section elements. No <head>, no <html>. */
  main_html: z.string(),
  /** Markup for the page header (nav + tel link). Rendered once per page. */
  header_html: z.string(),
  footer_html: z.string(),
  /** The mobile sticky action bar, or an empty string when the design omits it. */
  sticky_html: z.string(),
});
export type RenderedPage = z.infer<typeof RenderedPageSchema>;

// ---------------------------------------------------------------------------------------------
// Assets (stage B)
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
// Copy map (provenance, written to copy_map.json)
// ---------------------------------------------------------------------------------------------

export interface CopyMapEntry {
  copy_id: string;
  page_path: string;
  text_sha256: string;
  source: 'placeholder' | { url: string; quote: string };
}

export interface CopyMap {
  paragraphs: CopyMapEntry[];
  placeholder_ratio: number;
}

export type BuildProfile = 'mockup' | 'production';
