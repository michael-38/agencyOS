## Scope and visitor mode

One long-form landing page, `versions/a/index.html`. Mode: **Persuade**.

## Audience, job, action

A prospective patient in the Salt Lake valley, months into research, comparing two to four
surgeons, on a phone at night. Job: decide whether to trust this surgeon with an irreversible,
appearance-altering operation. Action: **call 801-810-0761**. There is no online booking and no
published pricing, so the page's job ends at "make contact".

Confirmed in the ask round: **the before/after photography leads the first viewport**; the page
must refuse anything reading cheap or high-volume-discount; a visitor must believe within seconds
that **this surgeon is unusually well trained**.

## Proof and content

Facts come from `fact-sheet.md` only. Load-bearing: the training pathway (Carroll College,
University of Colorado Health Sciences Center, Case Western Reserve, University of Michigan, Mayo
Clinic), over two decades of surgical experience, the reconstructive foundation, 13 verbatim
reviews whose dominant theme is being talked *out* of procedures, and 63 real photographs.

Every `[CONFIRM]` item is omitted: no certifying board named, no rating or review count, no
pricing or financing, no staff names, no founding year, no service-area list.

## Chosen direction

**The Set Tray** (roll seed `509f9326`, assigned index 7 of 7).

The sterile field. Deep surgical drape green as the ground, chosen in life because it is the
optical complement of blood and lets a surgeon's eye rest. Instrument steel. Sterile-wrap blue.
Everything placed with a set tray's exactness: nothing floats, nothing decorates, every element
sits in its own position. Colour strategy **Drenched** — the drape *is* the surface, not an accent
on neutral. Dark, forced by the use scene: a phone at arm's length in a dark room at 11pm.

**Memorable moment:** the work laid out on the drape at full scale, placed rather than arranged,
so the photographs read as evidence on a field instead of decoration in a grid.

## Ingredient inventory (medium gate)

No image generation exists in this environment, so `visualize.md`'s three-comp round cannot run
and no comp approval is recorded. The medium gate still binds.

| Region | Medium | Source / note |
|---|---|---|
| Drape ground | CSS flat colour field | `#12332e`. No gradient, no texture image. |
| Surgeon portrait | raster photograph | `images/1000020839.jpg` — a human figure with lighting and depth is raster whatever the stack |
| Before/after set | raster photographs | six from `assets/`, consistent scale, placed on the field |
| **Primary CTA (own row)** | CSS + authored SVG | steel-edged plate carrying `tel:8018100761`; the world physically works the CTA, so it is signature material on the page's most important element |
| **TYPE** | self-hosted woff2 | display **Archivo** at `wdth` 125 (wide, engineered, equipment-labelling register); text **Onest**. Neither is on the banned-defaults list. Headline word silhouette checked before building on it. |
| Instrument rule / tick marks | authored SVG, 1px | measurement notation; one consistent stroke weight |
| Icons | authored SVG, single stroke | phone only. No emoji, no unicode glyph stand-ins. |
| Credential register | CSS type | set as a placed list on the field, not as cards |
| Reviews | CSS type | verbatim, first name and month/year as published |

**Accepted omissions the user is told about:** no operating-room or facility photography exists in
`assets/`, so no environmental shot appears; no instrument photography exists, so the tray reads
through placement and steel edges rather than a literal image of instruments.

## Constraints

Single self-contained `index.html`, inline `<style>`, no build step, no framework, no external
CSS/JS/font origins. Self-hosted woff2 only. WCAG AA. `prefers-reduced-motion` honoured. Medical
claims discipline: no outcome guarantees, no "permanent" or "risk free", no before/after presented
as typical. Secondary text tints from the drape hue, never gray.

## Unresolved decisions

- Board certification wording stays as the practice's own unqualified "board-certified" until the
  client names the board.
- Whether the practice wants the not-upselling reviews foregrounded as prominently as the roll's
  composition places them.
