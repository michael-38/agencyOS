# Fact sheet — Utah Valley Medical Spa

Every line traces to `source-content/`. **Nothing may be embellished; nothing absent may be
invented.** Items marked **[CONFIRM]** are NOT sourced and must not appear on either version.

## Identity

| Field | Value | Source |
|---|---|---|
| Business name | Utah Valley Medical Spa | medical-spa.md |
| Parent practice | Utah Valley Dermatology | medical-spa.md, nap.json |
| Lead physician | Dr. David Myers, certified **Expert Injector** | medical-spa.md |
| Phone | (801) 768-8800 — **text or call** | medical-spa.md, nap.json |
| `tel:` | `tel:8017688800` | derived |
| Email | info@uvderm.com | nap.json |
| Booking | Klara link `https://l.klara.com/YrDQnWz9cighdPwT` labelled "book a free consultation" | medical-spa.md |
| Primary location | Lehi, UT — the med spa is described as "our medical spa in Lehi" | medical-spa.md |

**Three practice locations** (nap.json, from the site footer):

| Location | Address | Phone |
|---|---|---|
| Lehi | 123 S 100 W, Lehi, UT 84043 | 801-768-8800 |
| Saratoga Springs | 250 E 900 N Suite 200, Saratoga Springs, UT 84045 | **[CONFIRM]** none published |
| Provo | 100 W 2nd N, Provo, UT 84601 | **[CONFIRM]** none published |

The med spa copy only ever claims **Lehi**. Do not imply med spa services at all three sites
without the client confirming it.

## Positioning (their own words)

- "a leading provider of medical-grade skincare treatments in Lehi, Utah"
- "Our welcoming and relaxing environment lets patients unwind during their treatments, while
  state-of-the-art technology ensures the best possible results"
- "**free consultations with our Master Aestheticians**" — a real, repeatable offer
- Dr. Myers "has helped hundreds of patients to attain their desired appearance"

The distinguishing fact against a standalone med spa: **this one sits inside a dermatology
practice**, so a physician injector and master aestheticians work under one roof.

## Team (published)

| Name | Role |
|---|---|
| Dr. David Myers | Expert Injector, leads the medical spa |
| Mariah Webber | **Lead** Master Aesthetician |
| Grace Barney | Master Aesthetician |
| Hailee | aesthetician — named by a patient in a review, no bio page found |
| Jason | named by a patient in a review, role unstated |

**[CONFIRM]** `providers.md` also lists Jordan Harris, DO and Steven Kelly, MD. It is unclear
whether they work in the med spa or only in dermatology. Do not put them on this page unconfirmed.

## Treatments (published)

**Injectables:** Botox ("reduces the appearance of fine lines and wrinkles. Patients see visible
improvement in 10-14 days"), dermal fillers.
**Devices:** Morpheus8 ("minimally invasive… combines microneedling and radiofrequency energy to
rejuvenate the skin"), SkinPen microneedling ("reduce the appearance of fine lines, wrinkles, acne
scars, and texture"), lasers.
**Skin:** chemical peels, HydraFacial, advanced facials, medical-grade skincare products.

*Note their own page carries a typo, "find lines" for "fine lines". Corrected above; do not
reproduce the typo, and do not quote that sentence verbatim as a testimonial-style claim.*

## Reviews — 6 published, verbatim, first name only

The site's carousel repeats these six; there are six distinct reviews, not twelve.

| Name | Excerpt (verbatim) |
|---|---|
| Margaret | "Dr. Myers and staff are just the BEST! He's a great Botox and filler guy, best I've ever had and I've been at this for 15 years and had many different injectors, all Advanced injectors, he's in a class by itself." |
| Crystal | "When I hit 40 I found my home care routine was not enough to stop the signs of aging like dark spots and wrinkles. I needed just that extra boost that a dermatologist and spa treatments can give." |
| Lexi | "I had micro-needling done on my face here! Hailee was my aesthetician. She was professional, friendly, and gave good instructions on aftercare. My appointment lasted about an hour. Procedure was pain free with the numbing cream!" |
| Hannah | "I had fillers done do to my face on Wednesday & they offered laser at no extra cost the following day to help with any bruising. I'm so pleased with the results of the fillers & the extra help I was given the following day with the laser." |
| Dawnetta | "Dr. Myers and his team are amazing!!! Thank you Hailee and Jason for your help!!! If you want the best and your not seeing Dr. Myers, your not getting the best results." |
| Jamie | "Did a chemical peel and bought some products. The girls were so nice and I can't wait to see my face after. Such a great place for all your skin care needs!" |

Reviews contain the patients' own spelling ("do to", "your not"). Ship **verbatim**; do not
silently correct, and do not edit for punch.

Recurring theme: the **physician injector** is the draw, and Crystal's line names the exact
differentiator — "a dermatologist *and* spa treatments".

## Awards

**Best of Utah Valley 2025 and 2026.** Both badges appear on the page. The awarding body reads as
"Best of Utah County / Utah Valley" — **[CONFIRM]** the exact award name and issuer before
setting it in type.

## Imagery

25 real photographs in `assets/`, provenance in `assets/PROVENANCE.txt`. Includes portraits of
Dr. Myers (`HTP_8021…jpg`), Mariah Webber (`HTP_7591…jpg`), Grace Barney (`IMG_0622…jpeg`), and
treatment shots for Morpheus8, Botox and microneedling. **No generated or stock imagery.**

Two YouTube videos are embedded on the source page (collagen; Botox vs fillers, channel has 5.27K
subscribers). Video is **not** carried over — no asset, and an embed would break the
self-contained-file rule.

## Explicitly NOT available — must not appear

- **[CONFIRM]** Opening hours. Absent from every page crawled, including the footer.
- **[CONFIRM]** Any price, package, or financing. None published.
- **[CONFIRM]** Star rating or review count.
- **[CONFIRM]** Phone numbers for Saratoga Springs and Provo.
- **[CONFIRM]** Whether Harris DO / Kelly MD serve the med spa.
- **[CONFIRM]** Years in business, patient volume ("hundreds of patients" is their claim about
  Dr. Myers' injectable patients specifically — do not generalise it to the spa).
- **[CONFIRM]** Exact wording and issuer of the Best of Utah Valley award.
- The monthly promotion page returned only 348 bytes and carried no offer text — **do not invent
  a current promotion.**
