# Roadmap: Benefit Mode

**Status: AUTHORIZED on 2026-10-27; the next piece of work, before the
`monopolele` theme, the production checklist and the Printful webhooks.** This
document is the authoritative specification for Benefit Mode.

Why now: Benefit Mode takes donations away from WordPress (`/give/`,
`/donations/`). The 2027 home page's «Donate now» and «Support & Perks» links
can then point at the shop, and the WordPress bridge theme, with the old receipt
code, can be switched off. Benefit Mode does not depend on Printful and can go
live before the Printful connector is complete.

Before the development branch is created, the open points in
[Open questions](#open-questions) are answered and recorded here (see
[Resumption protocol](#resumption-protocol)).

- Fork: `hermanfenderson/minshop`
- First user: Monopolele — Mediterranean Ukulele Fest, organized by
  Associazione Voltare Pagina ETS
- Recorded: 2026-10-17; PDF contribution receipts added 2026-10-18;
  crowdfunding mode (R13) added 2026-10-25; authorized, with the fiscal and
  document decisions (R11, R14, R15), 2026-10-27

## Context

Monopolele is a free international music festival funded by voluntary
contributions. Supporters may receive physical perks, such as merchandise, in
recognition of their contribution. They may also contribute without receiving
anything, through a special item called **Gratitude**.

The current WooCommerce implementation already supports this model. The goal is
to preserve and improve it in Minshop, as an optional, reusable Minshop
extension. Monopolele is the first installation, not a special case in the
code.

## Requirements (agreed decisions)

These decisions are fixed. A change requires an explicit new decision, recorded
in this file.

### R1. Commerce mode

- A runtime administrative setting: `commerceMode: "standard" | "benefit"`.
- `standard` preserves the existing Minshop behavior exactly.
- `benefit` activates contribution-based transactions.
- The two modes share as much of the existing commerce infrastructure as
  possible: catalog, cart, checkout, payment providers, settlement, inventory
  reservations, shipping, fulfillment, refunds, and emails.
- Benefit Mode is independent of i18n. It must work in a single-language store
  and must not depend on i18n internals. It uses i18n only to translate its
  user-facing text.

### R2. Contribution model

- Each benefit product has a configurable minimum contribution.
- The supporter sees ONE editable monetary amount field, initialized to the
  minimum. Example: "Minimum contribution: €20 · How much would you like to
  contribute? [ €20.00 ]".
- Any amount greater than or equal to the minimum is accepted.
- There is NO separate "extra donation" field.
- There is NO distinction between the minimum and any voluntary extra, either in
  the amount charged or on the contribution receipt. The whole chosen amount is
  one contribution.
- The applicable minimum is retained internally, for validation and historical
  consistency.

### R3. Encouraging higher contributions

- A friendly message encourages supporters to contribute more than the minimum.
  Example: "Your contribution helps keep Monopolele free and accessible to
  everyone. If you can, consider giving a little more!"
- The message is configurable and translatable through the i18n system.
- It is an encouragement, never an obligation. A contribution exactly equal to
  the minimum is valid.

### R4. Validation

- An amount below the minimum shows an immediate inline validation message and
  prevents form submission.
- The server always validates again. Client-side validation alone is
  insufficient.
- The minimum is validated when an item is added to the cart AND again at
  checkout.
- Crafted HTTP requests and modified cart cookies must not be able to lower a
  contribution below its minimum.
- Product variants may have their own configurable minimums where appropriate.
- Amounts respect payment provider limits and currency precision.

### R5. Physical perks

- Physical perks keep their product identity, variants (e.g. T-shirt sizes),
  inventory, shipping requirements, shipping costs, and fulfillment workflow.
- The chosen contribution is independent of the declared monetary value of the
  physical item.
- The WooCommerce setup uses a zero-value goods document, with the contribution
  recorded separately as a single amount. The Minshop implementation must
  preserve the required information without artificial minimum/extra line
  items.
- This configuration does NOT by itself determine the legal or fiscal
  classification of the transaction. Receipt and fiscal-document behavior must
  be validated before production use.

### R6. Gratitude

Gratitude is a special virtual contribution item: support for the festival with
no goods and no digital deliverables.

- Configurable minimum contribution.
- One editable amount field.
- No physical shipping and no shipping charges.
- No inventory reservation and no stock limitations.
- No fulfillment workflow.
- No digital download or delivery.
- Same payment and order-processing infrastructure as other contributions.

### R7. Cart and checkout

- Each benefit line stores its selected contribution amount.
- Total payable = SUM(selected contributions) + applicable shipping charges.
- Contributions are never split into minimum and extra.
- The order snapshot preserves both the selected amount and the applicable
  minimum.
- Payment settlement, refunds, order history, and confirmation emails stay
  consistent.
- Orders with physical perks keep the existing inventory reservation and
  fulfillment guarantees.
- Standard commerce orders do not change behavior.

### R8. Internationalization

- Benefit Mode works with the new i18n architecture.
- All user-facing terminology is translatable. Illustrative label pairs, not
  hardcoded translations:

  | Standard | Benefit |
  | --- | --- |
  | Price | Contribution |
  | Buy now | Support Monopolele |
  | Minimum price | Minimum contribution |
  | Add to cart | Add contribution |

- Benefit Mode supports every configured locale and every supported URL routing
  strategy.
- It supports installations under a configurable `mountPath`. For Monopolele:
  English at `/shop/`, Italian at `/it/shop/`.

### R9. Upstream compatibility

- An optional, reusable Minshop extension.
- No Monopolele-specific business logic in the core commerce engine. Names such
  as "Monopolele" or "Gratitude" belong to configuration and content, not code.
- Eventually suitable for upstream as separate, focused PRs.
- Existing standard-commerce installations remain backward-compatible.

### R10. Development priority

Authorized on 2026-10-27 as the next piece of work. Limits:

- no production deploy; the test shop only with the owner's authorization;
- standard commerce mode stays identical, and no store-specific logic enters
  the core (R9);
- small, verifiable commits, pushed to GitHub;
- the development branch (`feat/benefit-mode`, from `feat/printful`) is
  created only after the open questions are answered and recorded here.

### R11. PDF contribution receipts

Benefit Mode generates a PDF donation receipt automatically, after the payment
has settled (never for an unpaid or pending order). Gratitude contributions,
with no physical perk, get a receipt too.

Fiscal frame (checked by the owner with the accountant, 2026-10-27):

- donations carry **no VAT**;
- the receipt is a **contribution receipt, not a fiscal document** (the
  "contribution acknowledgment" classification below is the one in use);
- shipping is charged at its **exact cost, with no margin**, so it raises no
  fiscal issue; this holds for shipments handled by the association itself
  (ukuleles) too. Shipping is documented apart (R15), never on this receipt.

The receipt carries:

- a progressive number in an **annual series** (`N/YYYY`), gapless, unique per
  issuing organization and **separate from receipts issued outside the shop**
  (paper or WordPress receipts keep their own series);
- the issue date and the transaction (settlement) date;
- the issuing organization's details, as in the owner's sample receipt: name,
  legal representative, registry entry, tax code / VAT number, address;
- the donor's identification (R14);
- order and payment references, and the means of payment;
- the total donation received, as ONE amount, in figures and in words;
- the configured wording for the donor's type and language (see below);
- an image of the organization's **stamp and signature**, uploaded in the
  admin (the sample receipt carries both). This is a graphic reproduction, not
  a qualified electronic signature, which is enough for a contribution
  receipt;
- an **annex listing the gifts shipped, each at zero value**. Gratitude is not
  a physical object and never appears in the annex; a Gratitude-only donation
  has no annex;
- **no shipping charges**.

Language, wording and delivery:

- Italian and English versions, in the language stored on the order.
- The wording changes by **donor type** (individual or company) and by
  **language**. It is configured in the admin; no legal reference is written in
  the code. Until the owner writes the final texts from the current receipt,
  the store ships placeholder texts.
- The PDF is reachable from the order confirmation page, through the same
  guest-access credential as the order page, never by a guessable id.
- Optional delivery by transactional email, through the existing outbox.
- Issued PDFs are kept on the site for **5 years**.

Integrity:

- An issued receipt keeps the wording, organization data and images it was
  issued with. Later edits to the store, the organization, or the wording do
  not alter it.
- Refunds never rewrite an issued receipt. A refund produces a **refund note
  with its own numbering**, then a **new receipt** for the amount that remains;
  the original receipt is not touched (the full-refund case is an open
  question).

Contribution amount:

- A contribution is ONE amount. The receipt does not split it into a
  minimum contribution and a voluntary extra (consistent with R2).
- The minimum is a validation parameter only and does not appear as a
  separate component of the contribution.

Legal classification, kept configurable for other stores:

- The implementation distinguishes a **contribution acknowledgment** from a
  **legally valid fiscal document**. The default is the acknowledgment: a store
  issues a fiscal document only when that classification has been validated
  and configured.

### R12. Receipt architecture

- Investigate during design whether PDF generation should be a reusable,
  optional Minshop module, with Benefit Mode supplying its own receipt
  template. Standard commerce mode could later reuse the module without
  depending on Benefit Mode.
- Do not introduce a complete invoicing system: no tax engine, no invoice
  series management beyond receipt numbering, no accounting exports.
- Compatible with:
  - the existing order infrastructure (paid-only orders, settlement, outbox,
    refunds);
  - the store-wide EUR currency, formatted with `formatPrice()` and integer
    minor units;
  - i18n (dictionaries and the order's stored locale);
  - mountPath (links built with the central URL builders);
  - standard commerce mode, which stays unchanged.
- PDF generation must run on Cloudflare Workers. Candidate approaches
  (a Workers-compatible library, Browser Rendering, or a pre-built template)
  are evaluated at design time. No PDF library is added before then.

### R13. Crowdfunding mode

Requested by the store owner on 2026-10-25. The two requirements below are
decided; everything under "Design proposals" is to confirm at resumption.

Requirements:

- A store can publicly show the **total raised** by some or all
  contributions, selected by product type (for example: one category of perks,
  Gratitude only, or every contribution).
- A store can publicly show the **list of supporters**.

Design proposals (to confirm):

- A campaign is configuration, not code: a slug, a title per locale, a product
  selection (by category through `product_categories`, or an explicit list),
  optional start and end dates, and an optional goal that can stay hidden
  until the owner decides to publish it.
- The total counts settled contributions only, net of refunds, line by line:
  in a mixed cart only the selected lines count. Shipping charges never count.
- Optional manual adjustments by an admin, with a note, for contributions
  received outside Minshop (bank transfers, card terminals, earlier
  campaigns).
- The supporter list is opt-in at checkout. The supporter chooses whether to
  appear, under which display name (or as anonymous), and whether the amount
  is shown. Default: not listed. Privacy wording is reviewed before
  production.
- Shown in the shop through the presentation models (translatable labels),
  and exposed as a small public, cacheable JSON endpoint under the mount (for
  example `/shop/api/campaigns/<slug>`), so a host site that Minshop does not
  serve can render the progress bar and the list.
- No store-specific logic in the core (R9). Possibly usable in standard mode
  too; see open questions.

### R14. Donor data

Minshop collects the donor's data **before payment**, not Stripe, and keeps it
in the shop's database for the receipts, whatever the payment method. Today the
checkout collects only the email and, for orders to ship, the shipping address.

- A checkbox «Are you donating as a company?» («Sei un'azienda?»).
- Individual: first and last name, tax code (codice fiscale), address.
- Company: company name, VAT number (and the company's tax code when it
  differs), registered office. **Company donations are an explicit
  requirement.**
- Tax code or VAT number is **mandatory for Italian donors** (decided
  2026-10-27); the rule for donors abroad is an open question.
- Consent to appear in the public supporter list (R13), with the name to show
  or «anonymous»; companies appear under their company name. Collected from the
  first version, even though the public campaign page comes later. Default: not
  listed.

### R15. Shipping receipt

When an order has a shipping charge, it gets a separate **shipping receipt**,
with **no fiscal value**, for the shipping cost only. Shipping is charged at
exact cost (R11), so the donation receipt never includes it.

### R16. Scope for the first store (Monopolele)

- **Sponsorships do not go through the shop**: the shop handles donations
  only.
- **Stripe only** as the payment method on the Monopolele shop.
- Ukuleles and Gratitude are **not fulfilled by Printful**. Benefit Mode does
  not depend on Printful, and the minimum is a property of the Minshop product.
- The minimum contribution is **per unit** (decided 2026-10-27): a quantity of
  3 needs at least 3 × the minimum.
- **Promotion codes are off** in benefit mode (decided 2026-10-27).

## Current architecture: facts that matter

Observed on `feat/printful` at `d5e62e3` (2026-10-27); first observed on
`main` at `f04f9d3` (2026-10-17).

| Area | Today | Why it matters |
| --- | --- | --- |
| Cart cookie | `cookieName('cart')` = `{v: 2, items: {cartKey: qty}}`, httpOnly, unsigned, 30 days, qty capped at 99; a script-readable `cart_n` holds only the count. `cartKey` = `prod_…[:var_…][#xtra_…,…]` (`src/features/cart/cart.ts`, `key.ts`) | There is no place for a per-line amount, and the key cannot tell apart two lines of the same product with different amounts |
| Price authority | The server recomputes `lineUnitPriceCents()` (`key.ts`) from D1 in `src/pages/api/checkout.ts` for the form, express and JSON paths. `/express` and `/checkout` pages compute it for display only; MCP `create_checkout` forwards to JSON `/api/checkout`; `/api/cart` accepts no price | Benefit Mode introduces the first client-supplied amount: a new trust boundary |
| Prices | `products.price_cents`, `product_variants.price_cents` (a variant's full price); `product_extras.price_delta_cents` added on top. Translation tables (0041) hold no commercial data. MCP admin tools set `price_cents` directly | Natural carriers for product and variant minimums; extras need a decision |
| Stock | `stock` on products and variants; still no "unlimited" concept. `reserveInventory` inserts a hold only when every target has enough stock, so stock 0 cannot sell. Reservation statuses and `order_inventory_exceptions` (0039) | Gratitude needs a non-inventory item that never reserves stock |
| Shipping | `requires_shipping`, `weight_grams` (0030); zone rates in config, combined with the fulfiller's live rate (`features/fulfillment/shippingQuote.ts`); `fulfillment_ref` / `fulfillment_rate_ref` and `order_fulfillments` (0043–0044) | Gratitude: `requires_shipping = 0` already exists. Ukuleles and Gratitude carry no fulfillment ref |
| Digital goods | `products.file_*` and `order_items.file_*` (0039); downloads at `/order/[token]/download/[itemPublicId]` | Gratitude must never have a file |
| Order snapshot | `order_items`: `id, order_id, product_id, name, price_cents, quantity, variant_id, public_id, file_*, downloads`; extras only inside `name`. Stripe metadata carries only `public_id`, `reservation_id`, `locale`, `shipping_weight_grams`; the line snapshot lives in `checkout_reservations.items`. Lightning keeps `pending_payments.items`. Orders store `locale` (0040) | The minimum and the donor data go into the D1 snapshot, not into Stripe metadata |
| Stripe | `price_data.unit_amount` per line; `allow_promotion_codes` when discounts are enabled; `automatic_tax` with `tax_behavior: 'exclusive'`; no `custom_fields`, no tax-id collection | Promotion codes off and no tax on contributions in benefit mode; donor data is collected by Minshop (R14) |
| Refunds | Amount-based per order (`refunded_cents` generated, provider/external split, review fields) | Compatible with one amount per contribution; drives refund notes (R11) |
| Other entry points | Express (`/express`), JSON `POST /api/checkout`, MCP `create_checkout`, `/api/products` (`price {amount, cents, currency}`), JSON-LD `Offer` (`features/storefront/productDetail.ts`), `llms.txt` | Each must accept or explain an amount |
| i18n | Dictionaries in `src/i18n/messages/{en,it}/`; presentation models in `src/features/storefront/models.ts`; URLs only through `LocaleUrls` (`src/i18n/urls.ts`) and `storeUrls`; per-locale settings text exists (`announcement:<locale>`, `api/admin/translations.ts`). The i18n design document cited below is not in the repository | The three openings Benefit Mode needed are in place |
| Documents | No PDF library and no receipt or invoice code; the only PDF is the Shippo label. No per-year counter table. The customer "receipt" is the confirmation email via the outbox (0032) | Receipts, numbering and PDF generation are new work (R11, R12) |

## Proposed design (to confirm at resumption)

A sketch, not a commitment. It reuses existing structures wherever possible.

### Settings and data

- `commerceMode` as a new runtime `SettingKey` in D1, default `standard`. A
  missing row means standard mode.
- **Minimums reuse existing price columns.** In benefit mode,
  `products.price_cents` and `product_variants.price_cents` mean "minimum
  contribution". No duplicate columns, and switching modes needs no data
  migration. The admin form labels change with the mode.
- **Gratitude is configuration, not code.** Any product with
  `requires_shipping = 0`, no file, and a new "not inventory-tracked" flag
  behaves as Gratitude. The core never checks a product's name.
- New flag: `products.track_inventory` (default 1), so a product can skip
  reservations and stock checks. This is useful to standard mode too (services,
  donations), and is a good standalone upstream PR.
- Order snapshot: add `order_items.min_price_cents` (nullable; NULL = standard
  line). `order_items.price_cents` holds the chosen contribution. The same field
  goes into the Stripe metadata snapshot and `pending_payments.items`.
- Optional: `orders.commerce_mode`, so history stays readable if the store
  switches modes later.

### Cart

- Cookie format v3: `items: {cartKey: {q: qty, a: amountCents}}`. A v2 cookie is
  read as `a` = current minimum, so existing carts survive.
- The amount is part of line identity. Adding the same product and variant with
  a different amount updates that line's amount instead of creating a second
  line. To confirm.
- No signature is needed. The cookie can only carry a supporter's own chosen
  amount, and the server re-validates `amount >= current minimum` on every cart
  write and at checkout. If an admin raises a minimum after an item was added,
  checkout rejects the line with a clear message and keeps the cart.

### Validation

- A pure module (e.g. `src/features/benefit/amount.ts`) with no Cloudflare
  imports, unit-tested: parses user input in the store currency, converts to
  integer minor units with `minorUnitsPerMajor()`, and checks minimum, maximum,
  and precision.
- Maximum: the provider limit (Stripe's per-charge maximum), plus an optional
  per-store safety cap against typos (e.g. €10,000). Both configurable.
- Client side without JavaScript: `<input type="number" min step required>`
  gives native inline validation and blocks submission. A small progressive
  enhancement can replace the browser message with the translated one. This
  respects invariant 1 (near-zero client JS).
- Server side: on `POST /api/cart`, in the checkout form path, in JSON checkout,
  and in the express path.

### Checkout and payments

- `unitPriceCents` comes from the validated cart amount instead of D1 when
  `commerceMode = benefit`. This is the ONE place where the price source
  changes. The rest of the pipeline (shipping, reservations, providers,
  settlement, emails) receives the same `lines` shape as today.
- Physical perks keep reservations and fulfillment unchanged. Gratitude lines
  skip reservations and shipping weight.
- Stripe: `unit_amount` = contribution. Promotion codes off in benefit mode
  (decision needed). `automatic_tax` off unless fiscal validation says
  otherwise.
- Lightning: unchanged. The fiat total converts to sats as today.

### Presentation and i18n

- Mode-aware dictionary keys (e.g. `benefit.product.amountLabel`,
  `benefit.cart.addContribution`), chosen by the presentation builders from
  `commerceMode`. Themes receive the labels already resolved in their models.
- The encouragement message is editable content, not a dictionary string: a
  per-locale setting, like the announcement in the i18n design, with a default
  from the dictionary.
- Every form and redirect uses the central URL builders, so mountPath and all
  routing strategies work with no Benefit-specific code.

## Architectural conflicts and dependencies

| # | Conflict or dependency | Impact | Proposed resolution |
| --- | --- | --- | --- |
| 1 | The cart cookie stores only quantities | Cannot carry an amount; cannot tell apart two amounts for the same item | Cookie v3 with a per-line amount; v2 read as minimum |
| 2 | The price is always server-authoritative | Benefit Mode adds a client-chosen amount | Pure validator, re-run on every cart write and at checkout, against the current minimum |
| 3 | No non-inventory items | Gratitude would need artificial stock and would reserve it | `track_inventory` flag; reservations skip such lines |
| 4 | Extras add a price delta | Unclear how a delta combines with a single free amount | Proposal: extras raise the minimum; the supporter still enters one total. To confirm |
| 5 | Quantity semantics | Is the amount per unit or per line? | Proposal: per unit, minimum checked per unit, line = amount × qty; Gratitude fixed at qty 1. To confirm |
| 6 | Promotion codes and automatic tax | A discount or tax on a contribution changes what the supporter chose | Off in benefit mode by default; tax only after fiscal validation |
| 7 | Zero-value goods document (WooCommerce) | Stripe Checkout has no zero-value goods line next to a separate contribution | One line per perk with the contribution as its amount, and the minimum in the snapshot; the fiscal document is produced outside Stripe if required. Needs legal and fiscal validation |
| 8 | Public surfaces show "price" | `/api/products`, JSON-LD `Offer`, `llms.txt`, MCP | Expose `minimum_contribution` in benefit mode; JSON-LD via `PriceSpecification` with `minPrice`, or omit `Offer`. To confirm |
| 9 | Express "buy now", JSON checkout, MCP `create_checkout` | Today they pass only items and quantities | Optional `amount` per item, defaulting to the minimum |
| 10 | Stripe metadata size limit | The compact items snapshot grows with the minimum | Short field (`m`), or move the snapshot to D1 keyed by session |
| 11 | i18n dependency | Labels, encouragement text, URLs, emails | Needs i18n steps 2 (engine), 4–6 (mountPath, URL builders, middleware) and 7 (strings) from the i18n plan |
| 12 | Order history across modes | A store that switches modes reinterprets `price_cents` | Store `min_price_cents` per line and, optionally, `orders.commerce_mode` |
| 13 | Receipts must be immutable and numbered progressively | Nothing today stores issued documents or allocates sequential numbers; D1 has no sequences | A receipts table with an atomic per-organization counter, written in the settlement batch; the PDF stored in R2 once and never regenerated. To confirm |
| 14 | Receipt language and links | Emails and pages already follow the order's stored locale (i18n phase 5) | Reuse `orderLocale()` and `emailLanguage()`; no new mechanism |

No conflict blocks the current i18n work. The i18n implementation should,
however, keep three things open for Benefit Mode:

- labels built through presentation models, so a mode can swap them;
- every cart and checkout form built with the central URL builders;
- per-locale editable settings text (needed for the encouragement message).

## Future implementation checklist

To start only after explicit authorization and after the resumption review.

- [ ] Review the completed i18n architecture against this document.
- [ ] Resolve the open decisions (conflicts 4–10 and the questions below).
- [ ] Obtain legal and fiscal validation of receipts and documents, including
      the zero-commercial-value declaration and every legal reference.
- [ ] Decide the receipt's legal classification per store (acknowledgment or
      fiscal document) and the refund/correction document.
- [ ] `track_inventory` flag (standalone, useful upstream).
- [ ] `commerceMode` setting and admin UI.
- [ ] Pure amount validator with tests (precision, minimum, maximum, JPY/BHD).
- [ ] Cart cookie v3 with backward-compatible v2 reading.
- [ ] Server validation on cart add, checkout form, JSON checkout, express path.
- [ ] Order snapshot: `order_items.min_price_cents` and the provider snapshots.
- [ ] Checkout price source switch, limited to benefit mode.
- [ ] Gratitude behavior: no reservation, no shipping, no fulfillment, no file.
- [ ] Mode-aware labels and the encouragement message, in every locale.
- [ ] Emails, order page, and admin order view showing one amount per line.
- [ ] Refund flows checked with contribution orders.
- [ ] Decide whether PDF generation is a reusable optional module (R12) and
      choose a Workers-compatible generation approach.
- [ ] Receipt numbering, storage and immutability (R11), with tests for
      concurrent settlements.
- [ ] Receipt templates in Italian and English; configurable legal wording.
- [ ] Receipt link on the order page and optional email delivery via the
      outbox.
- [ ] Public API, MCP, JSON-LD, and `llms.txt` semantics.
- [ ] Tests: crafted requests, tampered cookies, minimum raised mid-cart,
      mixed perk + Gratitude carts, standard-mode equivalence unchanged.
- [ ] Crowdfunding mode (R13): campaigns, totals, opt-in supporter list,
      public JSON endpoint, admin adjustments.
- [ ] Monopolele acceptance under `/shop/` and `/it/shop/`.

## Upstream PR outline

Each PR is optional and backward-compatible; standard stores see no change.

1. `track_inventory` flag (non-inventory products).
2. `commerceMode` setting and the pure amount validator.
3. Cart cookie v3 with per-line amounts (unused in standard mode).
4. Contribution checkout path and order snapshot (`min_price_cents`).
5. Mode-aware presentation labels and the encouragement message.
6. Public API, MCP, and SEO semantics for minimum contributions.

## Open questions

Decided on 2026-10-27 and recorded above: amount per unit (R16), promotion
codes off (R16), the receipt's classification (R11), annual receipt numbering
in a series separate from receipts issued outside the shop (R11), the donor
data and how it is collected (R14), the refund document (R11), retention of 5
years (R11).

Still open, with the recommendation to confirm:

1. **Gratitude quantity.** Always 1 (the amount is the knob). Recommended: yes.
2. **Extras in benefit mode.** Disabled. Recommended: yes.
3. **Scope of the mode.** Store-wide (`commerceMode`), not per product.
   Recommended: yes.
4. **Safety cap per contribution.** €10,000, configurable. Recommended: yes.
5. **Full refund.** Only the refund note, no new receipt (nothing remains to
   acknowledge). Recommended: yes.
6. **Numbering of refund notes and shipping receipts.** Each in its own annual
   series. Recommended: yes.
7. **Donors abroad.** Tax code mandatory only for residents of Italy; others
   give their country and, for companies, their own tax identifier.
   Recommended: yes.
8. **Wording for perk vs Gratitude.** Same text, the annex makes the
   difference; or a separate text. Recommended: same text.
9. **Privacy notice** for the donor data and the public list: a short notice
   at checkout linking to the shop's privacy page, written by the owner.
   Recommended: yes.
10. **Telling the series apart** from receipts issued outside the shop: a
    configurable prefix on the number (for example `S-12/2027`). Recommended:
    yes, empty by default.
11. **To confirm with the accountant** (not blocking development): whether a
    gift perk changes the deductibility wording; whether an emailed PDF with a
    stamp-and-signature image is acceptable without a handwritten signature.
- Crowdfunding (R13): campaign selection by category, explicit list, or
  both? Can one contribution count in several campaigns?
- Crowdfunding (R13): does the total include the full contribution or only
  what exceeds the perk's cost? Is it available in standard mode?
- Crowdfunding (R13): which supporter data may be published, and for how long
  after the campaign ends?

## Resumption protocol

1. Confirm explicit authorization to start Benefit Mode (given 2026-10-27).
2. Review the completed i18n architecture (routing, mountPath, URL builders,
   dictionaries, per-locale settings) and update the facts table above.
3. Re-check every "Current architecture" fact against the latest branch
   (done on `feat/printful` at `d5e62e3`, 2026-10-27).
4. Resolve the open questions and record the decisions here.
5. Only then create a development branch.

Production note, independent of Benefit Mode: before any production deploy,
the public checkout must show only payment methods that are enabled AND
operational, and demo checkout must be explicitly disabled on the Monopolele
and L'Altracittà stores. This is tracked in the i18n design document.
