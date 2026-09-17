// Stage D: markup. The model writes the body against the design contract; everything that has to be
// exactly right — the document shell, the head, the structured data, the breadcrumb, the skip link,
// and the unverified-copy notice — is emitted here so no generation pass can get it subtly wrong.
import { SITE_LIMITS } from '../config.js';
import { designContractBlock, siteRenderSystem, siteRenderUser, type RenderImage, type RenderNavItem, type RenderPageInput } from '../llm/prompts/site-render.js';
import { escapeHtml } from './escape.js';
import { assetHref, hrefBetween } from './paths.js';
import { buildBreadcrumbHtml, buildFaqHtml, buildHead, buildRelatedHtml, type SeoContext } from './seo.js';
import { RenderedPageSchema, type AssetRecord, type PlanPage, type RenderedPage } from './types.js';
import type { CopyIndex } from './copy.js';
import type { LlmParser } from '../llm/client.js';

/** Check ids that belong on the header's phone link rather than in a content section. */
const HEADER_CHECK_IDS = new Set(['tel-link', 'tel-link-above-fold']);
/** Check ids that belong on the mobile action bar. */
const STICKY_CHECK_IDS = new Set(['sticky-mobile-cta']);
/** Check ids the head satisfies. Tagging these on a paragraph is wrong, so the build places them. */
const HEAD_CHECK_IDS = new Set(['structured-data', 'jsonld-localbusiness', 'meta-title-description']);
/** Check ids the build's own FAQ block satisfies. */
const FAQ_CHECK_IDS = new Set(['faq-present']);

export const NOTICE_TEXT =
  'Preview: every sentence marked as unverified is placeholder copy and must be confirmed with the business before this page goes live.';

const NAV_KIND_ORDER = ['service', 'area', 'faq', 'about', 'contact'];
const MAX_NAV_ITEMS = 6;

export interface RenderContext {
  llm: LlmParser;
  model: string;
  seo: SeoContext;
  copy: CopyIndex;
  assets: AssetRecord[];
  designMd: string;
  telHref: string | null;
  telLabel: string | null;
  addressText: string | null;
  hoursText: string | null;
}

/** The pages that appear in the site navigation, home first. */
export function navPages(pages: PlanPage[]): PlanPage[] {
  const home = pages.find((p) => p.path === '/');
  const rest = pages
    .filter((p) => p.path !== '/')
    .sort((a, b) => {
      const ka = NAV_KIND_ORDER.indexOf(a.kind);
      const kb = NAV_KIND_ORDER.indexOf(b.kind);
      return ka === kb ? a.path.localeCompare(b.path) : ka - kb;
    })
    .slice(0, MAX_NAV_ITEMS - 1);
  return home ? [home, ...rest] : rest;
}

function navLabel(p: PlanPage): string {
  if (p.path === '/') return 'Home';
  return p.entity_name ?? p.breadcrumb[p.breadcrumb.length - 1] ?? p.h1;
}

/**
 * Hand out the real photographs section by section. Hero is unique to the page that asks for it
 * first; gallery images cycle so two sections never show the same photo unless there is only one.
 */
export class AssetAllocator {
  private cursor = new Map<string, number>();
  private usedHero = new Set<string>();

  constructor(private readonly assets: AssetRecord[]) {}

  take(role: string, pagePath: string, count = 1): AssetRecord[] {
    const pool = this.assets.filter((a) => a.role === role);
    if (!pool.length) return [];
    if (role === 'hero') {
      if (this.usedHero.has(pagePath)) return [];
      this.usedHero.add(pagePath);
      return [pool[0]];
    }
    const out: AssetRecord[] = [];
    let i = this.cursor.get(role) ?? 0;
    for (let n = 0; n < Math.min(count, pool.length); n++) {
      out.push(pool[i % pool.length]);
      i++;
    }
    this.cursor.set(role, i);
    return out;
  }
}

export function buildRenderInput(
  page: PlanPage,
  ctx: RenderContext,
  allocator: AssetAllocator,
  allPages: PlanPage[],
  repairNotes: string[],
): {
  input: RenderPageInput;
  lcpImage: AssetRecord | null;
  headChecklistIds: string[];
  faqChecklistIds: string[];
  internalLinks: { href: string; label: string }[];
} {
  const profile = ctx.seo.profile;
  const pageCopy = ctx.copy.byPath.get(page.path)!;
  const nav: RenderNavItem[] = navPages(allPages).map((p) => ({
    label: navLabel(p),
    href: hrefBetween(page.path, p.path, profile),
    current: p.path === page.path,
  }));

  let lcpImage: AssetRecord | null = null;
  const headerChecklistIds: string[] = [];
  const stickyChecklistIds: string[] = [];
  const headChecklistIds: string[] = [];
  const faqChecklistIds: string[] = [];

  const sections = page.sections.map((s, si) => {
    const copy = pageCopy.sections[si];
    const wanted = s.image_slot === 'none' ? [] : allocator.take(s.image_slot, page.path, s.image_slot === 'gallery' ? 3 : 1);
    const images: RenderImage[] = wanted.map((a) => {
      const isLcp = lcpImage === null;
      if (isLcp) lcpImage = a;
      return {
        src: assetHref(page.path, a.file, profile),
        alt: a.alt_from_source || `${s.h2} — photograph from ${ctx.seo.plan.business_name}`,
        width: a.width,
        height: a.height,
        role: a.role,
        isLcp,
      };
    });
    const ids: string[] = [];
    for (const id of s.checklist_ids) {
      if (HEADER_CHECK_IDS.has(id)) headerChecklistIds.push(id);
      else if (STICKY_CHECK_IDS.has(id)) stickyChecklistIds.push(id);
      else if (HEAD_CHECK_IDS.has(id)) headChecklistIds.push(id);
      else if (FAQ_CHECK_IDS.has(id)) faqChecklistIds.push(id);
      else ids.push(id);
    }
    return {
      id: s.id,
      h2: s.h2,
      opener: { copyId: copy.opener.copyId, text: copy.opener.text, placeholder: !copy.opener.verified },
      blocks: copy.blocks.map((b, bi) => ({ copyId: b.copyId, kind: page.sections[si].blocks[bi].kind, text: b.text, placeholder: !b.verified })),
      cta: s.cta ? { label: s.cta.label, href: ctaHref(s.cta, page.path, profile, ctx.telHref) } : null,
      images,
      imagePlaceholderLabel: s.image_slot !== 'none' && !images.length ? `${s.h2}: photograph needed` : null,
      checklistIds: ids,
    };
  });

  const internalLinks = ctx.seo.plan.internal_links
    .filter((l) => l.from_path === page.path)
    .map((l) => ({ href: hrefBetween(page.path, l.to_path, profile), label: l.anchor_text }));

  return {
    input: {
      path: page.path,
      kind: page.kind,
      h1: page.h1,
      primaryQuery: page.primary_query,
      nav,
      telHref: ctx.telHref,
      telLabel: ctx.telLabel,
      sections,
      businessName: ctx.seo.plan.business_name,
      addressText: ctx.addressText,
      hoursText: ctx.hoursText,
      stickyChecklistIds,
      headerChecklistIds,
      repairNotes,
    },
    lcpImage,
    headChecklistIds,
    faqChecklistIds,
    internalLinks,
  };
}

function ctaHref(cta: { kind: string; target: string }, fromPath: string, profile: SeoContext['profile'], telHref: string | null): string {
  if (cta.kind === 'tel') return telHref ?? '#contact';
  if (cta.kind === 'anchor') return `#${cta.target.replace(/^#/, '')}`;
  if (cta.kind === 'form') return `#${cta.target.replace(/^#/, '') || 'contact'}`;
  return hrefBetween(fromPath, cta.target.startsWith('/') ? cta.target : `/${cta.target}`, profile);
}

export async function renderPageMarkup(ctx: RenderContext, input: RenderPageInput, attempt: number): Promise<{ page: RenderedPage; usd: number; cacheHit: boolean }> {
  const res = await ctx.llm.parse({
    step: 'site-render',
    label: `${input.path === '/' ? 'home' : input.path.replace(/\//g, '_').replace(/^_|_$/g, '')}${attempt > 1 ? `-repair${attempt - 1}` : ''}`,
    model: ctx.model,
    system: siteRenderSystem(),
    content: [
      { type: 'text', text: designContractBlock(ctx.designMd), cacheable: true },
      { type: 'text', text: siteRenderUser(input) },
    ],
    schema: RenderedPageSchema,
    maxTokens: SITE_LIMITS.renderMaxTokens,
    thinking: { effort: 'low' },
    fallbacks: true,
  });
  return { page: res.parsed, usd: res.usd, cacheHit: res.cacheHit };
}

export interface AssembleOptions {
  page: PlanPage;
  rendered: RenderedPage;
  ctx: RenderContext;
  lcpImage: AssetRecord | null;
  /** True when any copy on this page lacks a verified source. */
  hasPlaceholders: boolean;
  /** Audit ids the head satisfies; tagged on the JSON-LD block. */
  headChecklistIds: string[];
  /** Audit ids the build's FAQ block satisfies. */
  faqChecklistIds: string[];
  internalLinks: { href: string; label: string }[];
}

/** Wrap the model's markup in the document shell. Landmarks and the head are ours, not the model's. */
export function assembleDocument(o: AssembleOptions): string {
  const { page, rendered, ctx } = o;
  const head = buildHead({ page, ctx: ctx.seo, lcpImage: o.lcpImage, checklistIds: o.headChecklistIds });
  const breadcrumb = buildBreadcrumbHtml(page, ctx.seo);
  const faqCopyIds = (ctx.copy.byPath.get(page.path)?.faq ?? []).map((f) => f.copyId);
  const faq = buildFaqHtml(page, faqCopyIds, o.faqChecklistIds);
  const related = buildRelatedHtml(o.internalLinks, ctx.seo.plan.business_name);
  const appended = [faq, related].filter(Boolean).join('\n');
  const notice = o.hasPlaceholders
    ? `  <div class="notice" data-placeholder-notice role="status" aria-live="polite">${escapeHtml(NOTICE_TEXT)}</div>\n`
    : '';
  const sticky = rendered.sticky_html.trim() ? `  ${rendered.sticky_html.trim()}\n` : '';
  return `<!doctype html>
<html lang="en">
<head>
${head}
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
${notice}  <header>
${indent(rendered.header_html, 4)}
  </header>
  <main id="main">
${breadcrumb ? `    ${breadcrumb}\n` : ''}${indent(rendered.main_html, 4)}
${appended ? `${indent(appended, 4)}\n` : ''}  </main>
  <footer>
${indent(rendered.footer_html, 4)}
  </footer>
${sticky}</body>
</html>
`;
}

/** Re-indent a fragment into the document shell while preserving its own nesting. */
function indent(html: string, spaces: number): string {
  const lines = html.replace(/\r/g, '').split('\n').filter((l, i, a) => l.trim() || (i > 0 && i < a.length - 1));
  const common = lines
    .filter((l) => l.trim())
    .reduce((min, l) => Math.min(min, l.length - l.trimStart().length), Number.POSITIVE_INFINITY);
  const strip = Number.isFinite(common) ? common : 0;
  const pad = ' '.repeat(spaces);
  return lines
    .map((l) => (l.trim() ? pad + l.slice(strip) : ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}
