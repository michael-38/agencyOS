# Fact sheet — La Belle Vie Medical Care & Aesthetics

Every line traces to `source-content/`, `source-content/nap.json`, or `assets/`. **Nothing may be
embellished; nothing absent may be invented.** Items marked **[CONFIRM]** are NOT sourced and must
not appear on either version.

Two source classes are used and are labelled per row:
- **text** — extracted markdown in `source-content/*.md`.
- **artwork** — copy that is published only as baked-in text inside a harvested image in `assets/`.
  Artwork copy is real published marketing, but it was never crawled as text, so it is transcribed
  here and flagged. Treat artwork copy as lower-confidence than text.

---

## Identity / NAP

| Field | Value | Source |
|---|---|---|
| Business name | La Belle Vie Medical Care & Aesthetics | nap.json; footer on every page |
| Short name in copy | La Belle Vie | home.md, all pages |
| Phone | 801-987-8384 | nap.json, home.md, laser-treatments.md, signature-services.md, med-spa-events.md, aesthetic-treatments.md |
| `tel:` | `tel:8019878384` | home.md (the site's own href) |
| Phone, other published formats | `(801) 987-8384` in aesthetic-treatments.md; `801-987-8384` everywhere else | text |
| Email | info@labelleviemedicalcare.com | nap.json |
| Street address | 248 E 13800 S, Suite 3 | nap.json; also baked into `Botox-and-biceps-867x1024.jpg` as "248 E 13800 S SUITE 3 DRAPER" |
| City / state / zip | Draper, UT 84020 | nap.json |
| Locations | **One.** Draper only. No second location is named anywhere. | nap.json, all text |
| Website | labelleviemedicalcare.com | page frontmatter |
| Hours | Monday & Wednesday 9:00 a.m. to 6:00 p.m., Tuesday & Thursday 9:00 a.m. to 5:00 p.m., Friday 9:00 a.m. to 3:00 p.m. | nap.json (extracted from the site footer) |
| Weekend hours | **[CONFIRM]** — Saturday and Sunday are simply absent from the published list. Do **not** render "Closed"; render only the five published days. | — |
| Online booking (Podium) | `https://booking.podium.com/medspa/019805bd-0a79-7949-8a5f-284144f5b4e0` — per-service deep links exist for most treatments | signature-services.md, laser-treatments.md, clitoxin page, home.md |
| Existing-patient portal (Boulevard) | `https://blvd.app/@labelleviemedicalcareandaesthetics/login`, labelled "Your appointments" | footer on every page |
| Contact page | `https://labelleviemedicalcare.com/contact/` | home.md and most pages |
| Facebook | `https://www.facebook.com/labelleviemedicalcare` | author box, o-shot + renuva + ozempic pages |
| Twitter / X | `https://twitter.com/labellevieMC` | same author box |
| YouTube | channel `UC-uyhGaOXlNAog40_OHIcRw`, **4 subscribers** | sculptra-treatment-in-utah.md |
| Service-area language used | "Draper, Utah", "Utah", "Salt Lake County", "the greater Salt Lake area" | home.md, renuva page |

**Two booking systems are live at once** — Podium for new bookings, Boulevard for existing
appointments. Both are published; both may be linked. Do not merge them into one "Book" button
without saying which is which.

---

## Positioning — the practice's own words

Use these verbatim or paraphrase closely. Do not upgrade the register.

**Site H1 (home.md):**
> "La Belle Vie — Client-Focused Medical Spa in Utah for Aesthetics & Wellness"

**Published tagline (home.md):**
> "REJUVENATE | RESTORE | MAINTAIN"

**The opening promise (home.md):**
> "At La Belle Vie, you'll get a tailor-made experience every time you walk through our doors. From
> your first visit, you'll feel welcome and receive the opportunity to have every question and
> concern addressed. Our team is dedicated to enhancing your beauty and unique features using a
> natural approach that leaves you feeling and looking your best."

**"the la belle vie difference" (home.md — their own section title, lowercase in source):**
> "At La Belle Vie, we prioritize a compassionate and caring atmosphere with the highest quality
> treatments for your non-surgical beauty solutions. The result? Exceptional results that leave you
> feeling empowered and renewed from within."

> "We understand your health and wellness concerns can be some of the most emotionally intimate
> topics you'll ever discuss with a medical provider. As professional Nurse Practitioners, we deeply
> care about our clients, ensuring you feel comfortable and at ease during every visit and
> consultation. La Belle Vie's team listens to your needs before recommending any treatment, helping
> you achieve results that feel natural and align with your vision."

**The owner's stated philosophy (aesthetic-treatments.md, first person, Kelly Lance):**
> "My philosophy at La Belle Vie isn't about changing who you are; it's about **Artistic
> Restoration**. It's about looking in the mirror and finally seeing the person you feel like on the
> inside—vibrant, rested, and ready for whatever life throws at you."

> "We aren't trying to give you a 20-year-old's face; we're trying to give you *your* face on its
> very best day."

> "We've all seen the 'overfilled' look on social media, and honestly? We're not fans of it either."

> "You're not a 'patient number'—you're a neighbor, and we're going to take care of you like one."

> "At the end of the day, we aren't in the business of needles and lasers—we're in the business of
> **confidence**."

**Anti-chain positioning (aesthetic-treatments.md):**
> "One of the reasons people feel hesitant is the 'conveyor belt' feel of some big med spa chains.
> At La Belle Vie, we do things differently." … "We don't just sell 'packages.' We create a roadmap
> that is specific to your face and your goals."

**On injectable restraint (signature-services.md, Signature Cheeks):**
> "Our professional, trained and experienced staff are experts in the art of natural looking
> enhancements. We won't leave you over-plumped or frozen-faced."

**Standing offer, stated repeatedly (home.md):** a **FREE consultation**. Phrased as
"Call our Draper, Utah, medical spa for a FREE consultation", "book a free consultation for a
brighter you", and "schedule a complimentary consultation". Two pages additionally advertise a
**"Free Virtual Consultation"**.

**Vocabulary note:** the site mixes "client" and "patient" freely, sometimes in the same paragraph.
Pick one per version and hold it. "Client" is the term used in the H1 and in the difference section;
"patient" is used in the clinical and blog pages.

---

## Team

| Name | Role, exactly as published | Source |
|---|---|---|
| **Kelly Lance, MSN, APRN, FNP-C** | "Owner and Provider at La Belle Vie Medical Care & Aesthetics"; "certified as a Family Nurse Practitioner and has advanced aesthetic training in multiple procedures"; "With over 30 years of experience" (home.md) / "With more than 30 years of experience" (author box). Writes in the first person as "the owner and primary practitioner". | home.md, o-shot, renuva, ozempic, aesthetic-treatments pages |
| Rebecca Buie | WordPress post author byline on `aesthetic-treatments.md` **only**. Her role at the practice is never stated, and the article itself is written in Kelly Lance's first-person voice ("Hi, I'm Kelly Lance"). **Do not present her as a provider or staff member.** | aesthetic-treatments.md |

**Kelly Lance is the only named provider on the entire site.** One person.

The copy nonetheless implies a larger team without naming anyone: "As professional Nurse
Practitioners, we…" (plural, home.md), "one of our aesthetic specialists here at La Belle Vie"
(sculptra page), "Our professional, trained and experienced staff" (signature-services.md), "Every
team member at our Utah medical spa" (home.md).

- **[CONFIRM]** Team size, and the names/credentials of anyone besides Kelly Lance.
- **[CONFIRM]** Whether more than one Nurse Practitioner in fact works there. The plural is used but
  never substantiated. Safe treatment: write "our team" / "our providers" generically, or centre the
  page on Kelly Lance by name, which *is* sourced.
- **[CONFIRM]** Rebecca Buie's role.

---

## Treatments

Nine service categories are published on the home page, plus roughly fifty individually named
treatments, devices and brands across the site. Descriptions below are the practice's own.

### A. Home-page service categories — their descriptions verbatim

| Category | Their description (home.md) |
|---|---|
| Injectable neurotoxins | "Look years younger and smooth out facial wrinkles with our injectable neurotoxins, including Botox, Dysport, Xeomin, and Jeveau. Feel confident in your skin again with our help." |
| Injectables / fillers | "Keep your skin feeling plump and wrinkle-free with La Belle Vie's injectable services in Utah. Boost your self-esteem immediately with our team's expertise." |
| Women's / sexual health | "Enhance your physical and sexual health at La Belle Vie's Utah medical spa. From vaginal rejuvenation to breast enhancement, experience confidence and vitality from the inside out." |
| Medical weight loss | "Do you struggle to lose weight? La Belle Vie offers medical weight loss treatments to help you easily reach your target weight. Meet your physical health goals with our customized guidance." |
| IV therapy & vitamins | "When you feel your best, it shows in every way. With Vitamin B12 shots and IV therapy designed to restore energy and hydration, you'll feel radiant, revitalized, and balanced from the inside out." |
| Men's health | "At La Belle Vie, our men's health services combine advanced therapies, including hormone replacement, PShots, shockwave therapy, and our signature 'ED Trifecta,' for comprehensive support of vitality, performance, and overall wellness." |
| Aesthetic treatments | "From our signature non-surgical facelifts to revitalizing facials, La Belle Vie is your one-stop destination for aesthetic treatments. Treat yourself—you deserve it." |
| Laser treatments | "Reduce the appearance of  acne scars, fade age spots, eliminate hair, and restore your skin's youthful glow with La Belle Vie's laser treatments. We deliver safe results customized to your preferences." |
| Specials | "Don't miss out on La Belle Vie's unbeatable deals, from seasonal specials to limited-time offers on your favorite treatments." |

*(The double space in "appearance of  acne scars" and the misspelling "Jeveau" are theirs — see
Typos below.)*

### B. Signature services — their descriptions verbatim (signature-services.md)

Page framing: *"La Belle Vie's Signature services are a few of our most popular services that our
patients return to us again and again because our technique and service are unmatched."*

| Service | Their description |
|---|---|
| **PDO Thread Lifts** | "If you like the idea of getting a facelift but are looking for something less invasive, the non-surgical PDO ThreadLift may be what you're looking for! What in the world are thread lifts? PDO Threads placed strategically under the skin have been highly effective and a minimally invasive way to improve firmness of the skin." |
| **Sclerotherapy for Spider Veins** | "If you are tired of unsightly spider veins, you have affordable options to help achieve smooth, beautiful legs. Sclerotherapy is an innovative procedure that does not require anesthesia and you can immediately resume normal activities. Sclerotherapy is an affordable treatment for spider veins and provides excellent results without risky surgery or downtime." |
| **Signature Cheeks** | "At La Belle Vie Medical Care & Aesthetics in Utah, we offer a wide range of cosmetic injectables and fillers to take care of wrinkles. These little miracles do the work of lifting and smoothing the lines that Mother Nature and Father Time have created. Our professional, trained and experienced staff are experts in the art of natural looking enhancements. We won't leave you over-plumped or frozen-faced." |
| **Signature Lips** | "Here at La Belle Vie, we believe that everyone should look and feel amazing. Located in Draper, Utah, we're one of the leading medical spas in the entire area. Our team has deep knowledge about the latest aesthetic techniques that help create the beautiful, natural look you've been searching for. From wrinkles and age spots to acne and sagging skin, we have the skills you need to feel gorgeous in your own body." |
| **Under Eye Filler** | "Looking a little tired?  Maybe you don't need some extra zzzz's but a just a little eye filler! Under-eye filler is a non-surgical treatment using hyaluronic acid to reduce dark circles, hollows, and fine lines. It restores volume, smooths the under-eye area, and delivers a refreshed, youthful look with immediate results, minimal downtime, and natural facial enhancement.  Don't trust this delicate skin to anyone but the professionals at La Belle Vie." |
| **Hand Rejuvenation** | "Taking exceptional care of your skin, including your face and the rest of your body, can help you look years younger than your age. However, the aging process is not as avoidable in the hands. After all, hands tend to go through a lifetime of daily wear and tear, involving exposure to the sun, water, strong household and grooming products, neglect, and other contributors to aging. But, the most severe changes in the hands are typically due to loss of tissue volume over the years." |

*Note: the Signature Lips description does not actually describe lips — it is a generic practice
blurb. If a version presents Signature Lips, either write a short factual line from the Lip Flip /
filler copy elsewhere on the site, or use the blurb as-is under a different heading. Do not invent
lip-specific claims.*

### C. Laser treatments — their descriptions verbatim (laser-treatments.md)

Page framing: *"Experience the revitalizing benefits of laser treatments at La Belle Vie. Our
advanced services include acne laser treatments, age spot removal, CO2 laser treatments, and IPL
photofacials. These versatile treatments effectively target skin concerns, enhancing clarity and
tone. Trust our expert team to deliver safe, rejuvenating results, tailored to your unique needs."*

| Service | Their description |
|---|---|
| **Acne Scar Treatment** | "La Belle Vie Medical Care & Aesthetics employs multiple strategies to greatly reduce the appearance of embarrassing acne and its scars. From our highly effective, minimally invasive, treatments to more aggressive treatments for acne and deeply scarred tissue, La Belle Vie determines the best strategy to improve the look and feel of your skin and give you a new-found confidence in your appearance." |
| **Age Spot Removal** | "La Belle Vie can effectively treat most benign pigmented lesions that are of a cosmetic concern using our state-of-the-art Harmony®XL light treatment. By exposing a pigmented lesion to short pulses of visible light, the temperature in the highly concentrated melanin can be raised sharply, enough to shatter the cells containing the melanin or blood. The body then replaces these cells with new cells generated by the surrounding untreated area. Simply put, our laser spot removal will zap those time-tellers into oblivion!" |
| **CO2** (published as "C02") | "C02 or Fraxel laser treatment is a laser treatment used on all range of skin colors and types to restore skin to its younger texture. After treatment patients can expect to have younger looking skin which is smoother, has improved tone and textures, and smaller pores. The treatment is also used to reduce the appearance of scars, lines, and deep wrinkles." |
| **CO2 Lite** (published as "C02 Lite") | "CO2 Lite is a revolutionary skin treatment that reduces fine lines, wrinkles, acne scars, and sun spots. It revitalizes your complexion, revealing firmer, smoother, radiant skin with less downtime than regular C02 Laser treatments. Great to treat acne scars." |
| **IPL Photofacial** | "As the light penetrates the skins' surface, the collagen and blood vessels that lay below the surface of the skin will begin to constrict. This reduces and draws out red pigment in the skin as well as reduces the color of dark age spots. At this point, the imperfections will absorb the light and work their way out of the skin. Spots on the skin will flake off revealing newer skin underneath. The light used in treatment will also stimulate the production of collagen which is a natural filler for wrinkles." |
| **Laser Hair Removal** | "Imagine the convenience and confidence of having silky smooth skin every day without plucking, shaving or waxing. There is now a pain-free way to permanently eliminate hair for stubble-free legs, underarms and bikini area. Thanks to the revolutionary Hair-Free™ laser hair removal treatment, nearly any part of the body can be treated safely and comfortably, including your upper lip, chin, neck, back, and stomach." **See Medical-claims risk — do not reuse "permanently eliminate hair" or "pain-free".** |
| **Profound for Acne Scars** | "The highly-effective treatment used to treat moderate to severe acne scars utilizes deep dermal heating for revolutionary results. La Belle Vie is proud to introduce the new Profound by Syneron to trigger the production of new collagen. The Profound treatment combines micro-diameter needles to deliver focused RF energy deep into your dermis, safely and effectively. The Profound treatment provides incredible collagen remodeling results with 3 to 5 days of downtime." |

### D. Sculptra® — dedicated page (sculptra-treatment-in-utah.md)

Their framing: *"The Game-Changer in Non-Surgical Anti-Aging Treatments - Sculptra®"* … *"It's a
revolutionary non-surgical treatment that stimulates collagen production, improving the texture and
elasticity of your skin."*

Sourced, quotable specifics:
- Mechanism: "injecting biocompatible poly-L-lactic acid (PLLA) into your skin's deep layers,
  triggering skin cells to produce more collagen."
- Areas treated, their list: **Face, Jowls, Temples, Hips, Buttocks** ("Known as the non-surgical
  butt lift… sometimes referred to as the 'Sculptra butt lift'").
- Candidacy, their list: "Diminish the appearance of deep-set wrinkles. Lift and revitalize sunken
  skin areas. Refine or soften facial contours. Address fat loss (lipoatrophy) resulting from HIV
  treatment."
- Duration: "often exceed two years in lifespan… Sculptra is not a permanent solution for deep
  wrinkles."
- Onset: "About 4 to 6 weeks after your treatment, you may start noticing gradual improvements…
  The full effect usually becomes apparent after a few months and can last up to two years."
- Aftercare: "avoiding strenuous activities for at least 24 hours"; "minor bruising or swelling at
  the injection site, which typically subsides after a few days."
- Consultation steps, their list: assess candidacy, discuss filler types, "Take photographs to track
  the progress and results of your treatment", discuss risks and side effects, schedule, answer
  questions.

### E. Sexual-wellness services — record factually, present with clinical restraint

**Handling instruction for both design agents.** These are real published services and may appear on
the page. Present them the way a clinic would: plain service names, plain benefit language taken
from the source, neutral imagery, no euphemism, no innuendo, no suggestive photography, no coy
headline play. They belong in the same visual register as Sculptra and lasers — not set apart as a
"spicy" section, and not hidden. Reproduce the practice's own framing that this is health care:
*"Sexual wellness is a vital part of your overall health, confidence, and quality of life."*

**Clitoxin®** (clitoxin-sexual-wellness-treatment.md) — their words:
- "an innovative, non-surgical sexual wellness treatment designed to enhance the female orgasm.
  Developed by Dr. Charles Runels, Clitoxin uses botulinum toxin to improve sensation, blood flow,
  and sexual satisfaction."
- "Clitoxin is a cutting-edge sexual wellness treatment for women that uses BOTOX® or other
  FDA-approved neurotoxins **off-label** to enhance clitoral function and orgasmic response."
- Mechanism: "The neurotoxin works by gently relaxing specific muscles around the clitoris, allowing
  for increased blood flow and heightened sensitivity."
- Their five listed benefits, verbatim headings: "Enhanced Sensitivity", "Increased Blood Flow",
  "Improved Sexual Satisfaction", "Non-Surgical & Minimally Invasive", "Quick and Convenient".
- Duration: "typically completed during a short office visit, usually in under one hour."
- Comfort: "A topical anesthetic is applied to ensure comfort during the procedure, and many women
  report only mild pressure or brief sensitivity."
- **Their own disclaimer, which must ship with any Clitoxin content:** "Keep in mind that results
  are not guaranteed with this therapy. While many women have experienced positive outcomes, it is
  important to have realistic expectations for this promising new use of botulinum toxin."
- Their differentiator: "women's health is approached with expertise, compassion, and discretion" in
  "a supportive, judgment-free environment".

**O-Shot** (all-about-the-o-shot-draper-utah.md, authored by Kelly Lance, dated March 26, 2020) —
their words:
- "a PRP (platelet-rich plasma)-based injection treatment that uses growth factors from your own
  blood to rejuvenate vaginal and clitoral tissue. After a small blood draw, the platelet-rich
  plasma is separated and strategically injected into areas associated with sensation, lubrication,
  and sexual response."
- Their stated goal: "to support healthier tissue, improve blood flow, and enhance nerve
  sensitivity, which may help improve orgasm intensity, libido, and comfort during intimacy."
- Their candidate list, verbatim: "Decreased libido · Difficulty reaching orgasm · Vaginal dryness ·
  Pain during intercourse · Mild urinary leakage · Decreased sensitivity after childbirth or
  menopause."
- Duration: "Results typically last 12 to 18 months, though individual results may vary."
- Comfort: "A topical numbing cream is typically applied before the injections… The entire O-Shot
  injection appointment usually takes less than an hour."
- **Hormone-free framing they use:** "a natural, hormone-free option for improving sexual health."
- **This page is the oldest content on the site (2020) and is written in a markedly cruder register
  than everything else** — e.g. "It can make the opening of your vagina markedly less loose", "If
  you feel close to asexual, it may be a lifesaver for your romantic relationship." **Do not carry
  any of that voice across.** Use only the clinical paragraphs quoted above.

**Related, named but not described:** vaginal rejuvenation (links to a **FemiLift** page), breast
enhancement, P-Shot ("PShots"), shockwave therapy, "ED Trifecta" (men's health). Only the category
blurb exists for these. **[CONFIRM]** any detail beyond the blurb.

### F. Renuva — dedicated blog page (goodbye-breast-implant-rippling…md, Kelly Lance, April 27, 2026)

- "Renuva uses an FDA-regulated, purified adipose (fat) matrix. It comes right out of a syringe."
- "Renuva acts like a microscopic honeycomb scaffold" and "the Renuva matrix completely disappears,
  leaving behind only your own natural fat."
- Their four stated advantages: "No General Anesthesia or Surgery" · "It's Your Own Tissue" · "It
  Feels Completely Natural" · "Zero Liposuction Required".
- Timeline: "Over the next 3 to 6 months, you'll watch as those annoying ripples gradually soften,
  smooth out, and disappear."
- Downtime: "You might be a little bruised or swollen for a few days, but there is zero major
  downtime."
- Also described in aesthetic-treatments.md for "age dips in the cheeks, temples, or even the backs
  of the hands."

### G. Medical weight loss and GLP-1 — highest claim sensitivity on the site

**The single most important negative fact on this site, stated twice by the owner:**

> "At La Belle Vie, we don't prescribe Ozempic."
> "While we don't prescribe Ozempic at La Belle Vie, we proudly support patients who are using it."

**Neither version may imply that La Belle Vie prescribes Ozempic, semaglutide, tirzepatide, or any
GLP-1.** No "GLP-1 program", no "weight-loss injections", no needle/vial imagery, no "lose X lbs".
What they actually offer is a **guided medical weight-loss program** and education alongside
medication prescribed elsewhere.

Their program, in their own words — the seven things they assess: **Hormone Balance, Metabolism,
Muscle Mass, Stress Levels, Sleep Quality, Nutrition Habits, Past Weight-Loss Attempts.**

Their three pillars: **"Education"** ("Understanding what's happening in your body and why"),
**"Accountability"** ("Regular check-ins and support throughout your journey"), **"Long-term
success"** ("Building habits and health that last, not just losing weight quickly").

Quotable lines:
> "Ozempic is a tool, not a plan."
> "Medical weight loss is not dieting. It's not about willpower, restriction, or punishing yourself
> for existing in your body."
> "We're not here to sell you a quick fix or make you feel bad about yourself."
> "I don't believe in shame, trends, or one-size-fits-all solutions when it comes to weight loss."

Their published FAQ answer, safe to reuse: *"Can I work with La Belle Vie if I'm already on Ozempic?
Yes. Many patients come to us for education, nutrition guidance, and long-term planning while using
medication prescribed elsewhere."*

**Do not reuse** the category blurb phrase "help you easily reach your target weight" — "easily" is
an outcome promise the rest of their own content contradicts.

### H. Treatments named only in editorial copy (aesthetic-treatments.md)

Real and quotable, but described in a conversational blog register rather than as service listings:
**PRP Facials** ("We use your body's own rich plasma to trigger collagen production"),
**Microneedling** ("like a gym workout for your skin"), **Chemical Peels** (light "lunchtime peel"
through deeper), **Laser Resurfacing**, **CoolSculpting** ("we can literally freeze them away"),
**Baby Botox**, **Lip Flip** ("uses a tiny bit of Botox to relax the upper lip"), **Under-Eye
Brightening**, **Stretch Mark & Scar Treatments**, **Hydrating Facials**, **Medical-Grade
Skincare**, **IV Hydration**, **Hormone Optimization**, **Vitamin Infusions**, **Preventative Skin
Tightening**, **Jawline & Chin Definition**, **Cheek Support**.

Their published comfort FAQ, quotable:
> "Q: Is it going to hurt? A: We are big fans of 'comfort first.' Between medical-grade numbing
> creams, cooling devices, and a very gentle touch, most of our clients are pleasantly surprised by
> how easy the process is."
> "Q: Will everyone know I 'had work done'? A: Not if we have anything to say about it! Our goal is
> for people to notice you look great, but not be able to point to why. We aim for 'Gosh, you look
> rested,' not 'Who did your filler?'"

---

## Reviews

**There are zero published reviews or testimonials in the crawled source.** Ten pages, no review
carousel, no testimonial block, no quoted patient, no star rating, no review count, no Google/Yelp
widget, no named patient anywhere.

This is the largest single gap in the fact set and it changes the shape of both builds.

- **[CONFIRM]** Every review. Do not write one. Do not paraphrase one. Do not build a testimonial
  section with placeholder copy that reads as real.
- **[CONFIRM]** Star rating, review count, "rated 5 stars", "hundreds of happy clients", or any
  numeric social proof.
- **Do not** convert the home page's marketing sentence *"you'll be part of our growing family of
  satisfied clients who rave about their glowing results"* into a proof element. It is the
  practice's own copy about itself, not evidence, and typesetting it as a pull-quote would read as
  a testimonial.

**The proof that is actually available**, in descending strength, and what both versions must lean
on instead:
1. Kelly Lance by name — owner, FNP-C, 30+ years, first-person voice throughout the site.
2. Her own writing. She is a genuinely distinctive voice; long verbatim passages are on hand.
3. The named device and product roster (Harmony®XL, Profound by Syneron, Sculptra®, Renuva,
   CoolSculpting, Hair-Free™, Clitoxin®).
4. The free consultation, and the free *virtual* consultation.
5. The live August 2026 promotion (see below).

---

## Awards

**None.** No award, badge, "Best of", ranking, or press mention appears anywhere in the crawled
source. **[CONFIRM]** — do not render an awards row, a badge strip, or an "as seen in" band.

The only superlative published is self-declared, in signature-services.md: *"we're one of the
leading medical spas in the entire area."* That is their claim about themselves. It may be quoted as
their voice; it may not be typeset as a third-party endorsement.

---

## Offers, promotions and events

### Live promotion — August 2026 Summer Specials

Published on the home page **as artwork only** (`assets/AUG2026-Specials-Main.jpg` and
`AUG2026-Specials-email.jpg`), linking to `/monthly-specials/`. Transcribed from the images:

> **LA BELLE VIE'S AUGUST 2026 — SUMMER specials**
> **RENUVA** — $500 OFF 6 CCS*
> **ANY SERVICE** — $50 OFF*
> **EUROPEAN FACIAL** — BUY ONE FACIAL GET A FREE LED LIGHT SESSION*
> **MICRONEEDLING + CHEMICAL PEEL** — BUY A PACKAGE OF 3 FOR $599 GET A FREE DERMAPLANING ADD-ON*
> *"Buy Online* before August 31, 2026. Can't be combined with other offers or membership benefits,
> unless otherwise specified. Prices good until 08/31/2026."*

Handling:
- **These expire 08/31/2026.** The crawl is dated 2026-08-13. Anything shipped after 31 August is
  wrong. Safest treatment: link to `/monthly-specials/` with neutral wording ("See this month's
  specials"), or reproduce the specials **image itself** so the offer and its own expiry travel
  together. Do **not** re-typeset the four offers as live page copy without the expiry line.
- This is the only place the site names **European Facial**, **LED Light Session**, **Dermaplaning**,
  and **membership benefits**. The existence of a membership programme is implied by the fine print
  and is otherwise undocumented — **[CONFIRM]** memberships before mentioning them.
- **[CONFIRM]** All standard (non-promotional) prices. None are published. The only other prices on
  the whole site are discount amounts and giveaway values.

### First-treatment discount — the site contradicts itself three ways

On the same two pages (clitoxin, sculptra), within about forty lines of each other:

| Published as | Where |
|---|---|
| "**Free Virtual Consultation + Get $50 Off Your First Treatment**" (link label) | clitoxin page |
| "Free Virtual Consultation **+ Get $100 Off Your First Treatment**" (form heading) | clitoxin page, sculptra page |
| "Get **$50 off your first service** (excludes packages.)" (form fine print) | clitoxin page, sculptra page |
| "Mention this article and I'll give you **$50 off your first treatment**." | aesthetic-treatments.md |
| "**ANY SERVICE $50 OFF**" | August specials artwork |

**[CONFIRM]** the correct amount. Three of five say $50, so $50 is the likely truth — but "likely"
is not sourced. **Neither version may state a discount amount until the client confirms it.** Ship
"Free consultation" alone, which is unambiguous and repeated across the site.

### Events

- **"Botox & Biceps"** with Orangetheory — "Tuesday, February 17th at 5 pm at La Belle Vie", offering
  "Free Workout · $10/unit special · Free Swag Bag · giveaways for free Diamond Glow Facial ($199
  value) and a free month at Orange Theory ($169 value)". **No year is published**, in the text or on
  the flyer. Against a crawl date of 2026-08-13 this is stale or unverifiable either way.
  **[CONFIRM] — do not ship.**
- **"Annual Holiday VIP Event November 2026"** — "Every year we host a fantastic holiday event where
  our guests enjoy drawings, food, demonstrations and some of the best prices of the year!" A month
  and year, no date, no time. **[CONFIRM]** before featuring; at most it supports a general "we host
  an annual holiday event" line.

### Published policy fine print (med-spa-events.md) — safe to reuse verbatim

> "Our Monthly Specials cannot be combined with any other offer."
> "Birthday discounts are not eligible on special offers."
> "Any requested refunds for portions of packages not used, will be charged the full price and
> refunds given for the remaining balance at full price."

*(The birthday line is the only evidence a birthday discount exists. It is not described anywhere.
**[CONFIRM]** before promoting one.)*

---

## Medical-claims risk register

Both versions must run every claim past this list. Where a phrase is flagged, the instruction is to
**omit or soften**, not to add a footnote and keep the phrase.

| # | Published claim | Why it is a risk | Instruction |
|---|---|---|---|
| 1 | "a **pain-free** way to **permanently eliminate hair**" (laser-treatments.md) | Laser hair-removal devices are cleared for *permanent hair reduction*, not permanent removal; "pain-free" is an absolute comfort guarantee. | **Do not reuse.** Write "long-term hair reduction" and describe comfort measures instead of promising no pain. |
| 2 | Clitoxin uses neurotoxin **"off-label"** | The practice states this itself. Off-label promotion is the sharpest regulatory edge on the site. | Keep their own wording, and carry their own disclaimer ("results are not guaranteed with this therapy") on the same screen. Never present Clitoxin as FDA-approved for this use. |
| 3 | O-Shot outcome claims — "orgasm with greater regularity", "reduce urinary incontinence issues greatly", "Results typically last 12 to 18 months" | PRP for sexual function is not an FDA-approved indication; these are strong efficacy claims in an intimate-health context. | Use only the clinical description and the candidate list. Keep their qualifier "though individual results may vary". Drop every superlative from the 2020 page. |
| 4 | All GLP-1 / Ozempic content | Weight-loss drug claims are the most heavily policed category in aesthetics, **and the practice does not prescribe them.** | See section G. No implication of prescribing. Never say "easily reach your target weight". |
| 5 | Renuva "permanently padding the edges of your implant" and correcting breast-implant rippling | "Permanently" is an absolute; the breast-implant application is a strong use claim. | Describe the mechanism and the 3–6 month timeline. Drop "permanently". |
| 6 | Sculptra buttock and hip injection ("Sculptra butt lift") | Off-label body area for a facial PLLA product. | May be listed as an area they treat. Do not headline "non-surgical BBL". |
| 7 | Sculptra "Address fat loss (lipoatrophy) resulting from HIV treatment" | This *is* the on-label indication, and is fine — but it reads oddly in consumer marketing and could be mistaken for a claim to treat HIV. | Safe to omit entirely. If kept, keep their exact wording. |
| 8 | Hormone replacement / hormone optimization, shockwave therapy, P-Shot, "ED Trifecta" | Prescription and device-based men's-health services with no supporting description anywhere. | List by name only, or omit. Do not describe mechanisms or outcomes. |
| 9 | "Boost your self-esteem **immediately**" (home.md injectables blurb) | Immediacy + psychological-outcome promise. | Do not reuse. |
| 10 | "These little miracles" (signature-services.md, fillers) | "Miracle" is the classic flagged word in aesthetic advertising. | Do not reuse. |
| 11 | "we **can fix it**— without another surgery" (renuva page) | Unqualified guarantee. | Do not reuse. |
| 12 | "La Belle Vie can **effectively treat** most benign pigmented lesions" | Diagnosis-adjacent; "benign" implies an assessment. | Keep as-is only if quoted as their description; do not amplify. |
| 13 | "We deliver **safe results**" (laser blurb) | Safety guarantee. | Soften to a description of medical oversight. |

**A general disclaimer line is warranted on both versions**, e.g. *"Individual results vary. All
treatments require a consultation to determine whether you are a candidate."* This is consistent
with the practice's own published qualifiers and invents nothing.

---

## Typos and defects in their own marketing — fix silently, do not reproduce

| Published | Correct | Where |
|---|---|---|
| "Jeveau" | **Jeuveau** (the actual product name) | home.md, injectables blurb |
| "C02", "C02 Lite", "regular C02 Laser" | **CO2** (letter O, not zero) | laser-treatments.md headings and body |
| "the skins' surface" | "the skin's surface" | laser-treatments.md, IPL |
| "Book ONline" | "Book Online" | signature-services.md, Sclerotherapy |
| "Its called Renuva." | "It's called Renuva." | renuva page |
| "reduce the appearance of  acne scars" (double space) | single space | home.md |
| "Looking a little tired?  Maybe you don't need some extra zzzz's but a just a little eye filler!" | "…but just a little eye filler" | signature-services.md, Under Eye Filler |
| "trends.I've been" / "course.This list" (missing spaces after full stop) | add the space | ozempic page |
| "Orange Theory" (body text) vs "Orangetheory" (the brand, as on the flyer) | **Orangetheory** | med-spa-events.md |
| `http://ooking.podium.com/…` — broken Sculptra booking link, missing the "b" | `https://booking.podium.com/…` | sculptra page |
| `## Add Your Heading Text Here` — an unedited Elementor placeholder heading shipping live above the tagline | delete | home.md |

The Elementor placeholder and the broken booking link are worth naming in the client hand-off: they
are concrete, verifiable defects on the live site.

---

## Imagery inventory

`assets/` holds **32 harvested files**, listed with source URLs in `assets/PROVENANCE.txt`. One of
those (`labelleviemedicalcare.com`) is an **HTML document, not an image** — ignore it. That leaves
**31 usable images**, all sourced from the client's own WordPress uploads.

**These are not all original clinical photography.** Five carry Shutterstock copyright in their EXIF,
recorded here from the files' own metadata rather than inferred:

| File | EXIF copyright string |
|---|---|
| `Botox-and-biceps-867x1024.jpg` | "Copyright (c) 2026 **Shutterstock AI**/Shutterstock. No use without permission." |
| `La-Belle-Vie-Benefits-Of-Clitoxin.jpg` | "Copyright (c) 2020 puhhha/Shutterstock. No use without permission." |
| `Sexual-Wellness-Treatment-Draper-Utah.jpg` | "Copyright (c) 2020 puhhha/Shutterstock. No use without permission." |
| `Non-Surgical-Anti-Aging-reatments-Sculptra.jpg` | "Copyright (c) 2019 MIRRORstudio/Shutterstock. No use without permission." |
| `The-Unmistakable-Benefits-of-Sculptra.jpg` | "Copyright (c) 2022 MIRRORstudio/Shutterstock. No use without permission." |

**Licensing instruction:** the client's Shutterstock licence covers the client's use on their own
site. Re-hosting those five files on an agency-owned Cloudflare Pages demo is outside it. **Prefer
the other 26.** If one of the five is genuinely needed for a comparison demo, keep it, but flag it in
the hand-off so it is swapped before any production launch.

**Categories of the rest:**
- **Treatment/condition headers, 1400×673**, mostly from a 2017 upload folder — `AcneScars-head`,
  `AgeSpots-head`, `SkinRejuvenation-head`, `Wrinkles-head`, `Varicose-Spider-Veins-head`,
  `LaserHairRemoval`, `LIPPOP2-2`, `HandRejuvenation-LaBelleVie`, `pdo-threads-facelift-in-utah`,
  `acne-treatment-header`, `clitoxin-sexual-health-treatment-for-women`, `Sculptra-Treatment-in-Utah`.
  Wide letterbox crops; they will need art direction, not just placement.
- **Blog headers, 992×600, built in Adobe Photoshop 2022** — the four Ozempic/weight-loss images,
  `On-the-Fence-About-Aesthetic-Treatments…`, `Boosting-Confidence-Through-Facial-Balancing`,
  `The-Era-of-the-Refresh-Not-the-Redo`, `Skin-Health-is-Health-Draper`,
  `The-Inside-Out-Glow-Aesthetic-Wellness`. Several carry a **baked-in yellow border** — check each
  before use; a bordered image dropped into a full-bleed slot will look broken.
- **Promotional artwork with baked-in text** — `AUG2026-Specials-Main.jpg` (1400×756) and
  `AUG2026-Specials-email.jpg` (1044×1044). Both carry the dated August 2026 offers and expiry.
  Usable **only** as the specials block, never as generic decoration.
- **Event flyer with baked-in text** — `Botox-and-biceps-867x1024.jpg`. Undated event, Shutterstock
  AI source. **Do not ship.**

**Imagery gaps — [CONFIRM]:**
- **No photograph of Kelly Lance.** The home page references
  `kelly-lance-MSN-APRN-FNP-C.jpg` and the author boxes reference a gravatar, but neither was
  harvested. The site's single strongest proof asset is therefore unavailable. Both versions must
  work without a provider portrait. Do not substitute a stock person.
- **No logo file.** `la-belle-vie-logo-footer.png` is referenced but not harvested. The wordmark is
  legible baked into `AUG2026-Specials-email.jpg` and `Botox-and-biceps-867x1024.jpg`: a script
  "La Belle Vie" with a small daisy replacing the dot over the "i". Set the name in type rather than
  extracting a logo from a JPEG.
- **No interior, treatment-room, or team photography.** The home page references a treatment-room
  image but it was not harvested.
- **No before/after images.** None exist in the source. Do not build a before/after component.
- **No anniversary graphic.** The home-page hero alt text reads
  "La-Belle-Vie-11-Year Anniversary" and the file was not harvested — see the founding-year note
  below.

**Register note for the design agents:** the harvested photography is conventional aesthetic-industry
stock — smiling model, soft grey seamless, glowing skin. It reads as generic stock photography. Neither
version should try to make it carry the page. Lean on typography, the treatment roster, and Kelly
Lance's own words; use the imagery in supporting positions and crop it hard.

---

## Brand marks and colours actually observed

Not a brand guideline — just what is visible in the harvested artwork, offered so neither version
invents a palette that fights the client's real one.

- **Wordmark:** "La Belle Vie" in a flowing script, with a daisy glyph over the "i".
- **Colours in the promotional artwork:** black, white, and a saturated **yellow** used for the CTA
  block, the daisy centre, and the image borders. Sunflower/daisy motifs recur.
- **Photographic treatment:** desaturated to near black-and-white with a single yellow element left
  in colour.

**This conflicts with the seeded `DESIGN.md`, which inherits the med-spa world's warm-cream and
terracotta palette.** Neither is wrong on its own, but the divergence is deliberate per
`.impeccable/prep-report.json` (Version A dark ground, Version B light ground), so **treat yellow as
available evidence, not as a mandate.** Whatever is chosen, choose it knowingly. **[CONFIRM]** the
official brand palette and hex values with the client.

---

## Explicitly NOT available — must not appear on either version

Each of these is absent from all ten crawled pages. Anything on this list that shows up in a build is
a fabrication.

1. **[CONFIRM] Every review and testimonial.** Zero exist. No quoted patient, no name, no date.
2. **[CONFIRM] Star rating and review count.** No Google, Yelp, RealSelf, or aggregate rating.
3. **[CONFIRM] Any award, badge, "Best of", ranking, or press mention.**
4. **[CONFIRM] Standard prices for any service.** Only discount amounts and two giveaway values are
   published.
5. **[CONFIRM] The correct first-treatment discount amount.** The site publishes $50 and $100 for
   the same offer on the same page.
6. **[CONFIRM] Financing, payment plans, CareCredit, Cherry, or "as low as $X/month".** None
   published.
7. **[CONFIRM] Memberships.** Implied only by the phrase "membership benefits" in the specials fine
   print.
8. **[CONFIRM] Weekend hours.** Only Monday to Friday are published. Do not render "Closed" for
   Saturday and Sunday.
9. **[CONFIRM] Founding year, years in business, and the "11 Year Anniversary" claim.** The only
   trace is the home-page hero image's alt text,
   `La-Belle-Vie-11-Year Anniversary`. That is filename-derived alt text, not published body copy,
   and no year is stated anywhere. **Do not print "Serving Draper since 20XX" or "11 years".**
10. **[CONFIRM] Team size and every team member other than Kelly Lance.** The copy uses "we" and
    "Nurse Practitioners" (plural) but names exactly one person.
11. **[CONFIRM] Rebecca Buie's role.** A byline only.
12. **[CONFIRM] Certifications, licences, board memberships, and certifying bodies.** The only
    credential published anywhere is Kelly Lance's "MSN, APRN, FNP-C" and "certified as a Family
    Nurse Practitioner". No medical director, no supervising physician, no state licence number, no
    AmSpa or society membership. **Do not add a physician.**
13. **[CONFIRM] Patient volume, treatment counts, "X,000 treatments performed", satisfaction
    percentages.** None published.
14. **[CONFIRM] Before/after imagery and results galleries.** None exist.
15. **[CONFIRM] A photograph of Kelly Lance, the logo file, and interior/team photography.** All
    referenced on the live site, none harvested.
16. **[CONFIRM] Second location, service-area list, or "serving X, Y and Z".** Draper is the only
    address; "Salt Lake County" and "the greater Salt Lake area" appear as prose, not a service-area
    claim.
17. **[CONFIRM] The "Botox & Biceps" event year.** Undated in both the text and the flyer.
18. **[CONFIRM] Specific date and time for the November 2026 Holiday VIP Event.** Month and year
    only.
19. **[CONFIRM] Birthday discount terms.** Referenced only in an exclusion clause.
20. **[CONFIRM] Details of FemiLift, P-Shot, shockwave therapy, "ED Trifecta", breast enhancement,
    and vaginal rejuvenation.** Named in a category blurb; never described.
21. **[CONFIRM] Anything about GLP-1 prescribing.** The practice explicitly states it does not
    prescribe Ozempic.
22. **[CONFIRM] The `/monthly-specials/` page content** beyond what is legible in the two specials
    images. That page was not crawled.
23. **[CONFIRM] Consultation length, appointment duration (other than the "under one hour" figures
    published for Clitoxin and the O-Shot), and wait times.**
24. **[CONFIRM] Insurance, HSA/FSA acceptance, or cancellation policy** beyond the three published
    fine-print lines.
25. **[CONFIRM] Emergency or after-hours contact.** None published.
