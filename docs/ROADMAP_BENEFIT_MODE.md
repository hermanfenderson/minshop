# Roadmap: Benefit Mode

**Status: DEFERRED. Do not implement.** The current priority is the complete
i18n implementation. This document is the authoritative specification for
Benefit Mode when development is explicitly authorized.

When work resumes, the first step is to review the completed i18n architecture
and confirm that the two features integrate cleanly (see
[Resumption protocol](#resumption-protocol)).

- Fork: `hermanfenderson/minshop`
- First user: Monopolele — Mediterranean Ukulele Fest, organized by
  Associazione Voltare Pagina ETS
- Recorded: 2026-10-17; PDF contribution receipts added 2026-10-18;
  crowdfunding mode (R13) added 2026-10-25

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

The feature is deferred. Until development is explicitly authorized:

- no application code changes;
- no database migrations;
- no changes to the i18n implementation;
- no dedicated development branch;
- no commits, pushes, or deploys for this feature.

### R11. PDF contribution receipts

Benefit Mode generates a PDF contribution receipt automatically, after the
payment has settled (never for an unpaid or pending order).

The receipt carries:

- a progressive receipt number, unique per issuing organization;
- the issue date and the transaction (settlement) date;
- the issuing organization's details;
- the supporter's identification;
- order and payment references;
- the total contribution received, as ONE amount;
- optionally, a description of the associated perk;
- shipping charges as a separate line, when the order has them.

Gratitude contributions, with no physical perk, get a receipt too.

Language and delivery:

- Italian and English versions, in the language stored on the order.
- The PDF is reachable from the order confirmation page.
- Optional delivery by transactional email, through the existing outbox.
- Secure storage and retrieval. Proposal, to confirm: the PDF is reached
  through the same guest-access credential as the order page, never by a
  guessable id.

Integrity:

- The originally issued document is preserved unchanged. Later edits to the
  store, the organization, or the wording do not alter an issued receipt.
- Refunds and corrections never rewrite an issued receipt. They are handled
  by a separate, linked document (for example a cancellation or correction
  notice), whose form is decided with the legal review.

Contribution amount:

- A contribution is ONE amount. The receipt does not split it into a
  minimum contribution and a voluntary extra (consistent with R2).
- The minimum is a validation parameter only and does not appear as a
  separate component of the contribution.

Legal and regulatory wording:

- Legal and regulatory references are configurable. No legislative reference
  is hardcoded unless it has been verified.
- Additional legal wording is configurable, per language.
- Any declaration that a physical perk has zero commercial value, and any
  legal or tax wording, must be reviewed and approved before production use.
- The document's legal classification is configurable. The implementation
  distinguishes a **contribution acknowledgment** from a **legally valid
  fiscal document**. The default is the acknowledgment: a store issues a
  fiscal document only when that classification has been validated and
  configured.

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

## Current architecture: facts that matter

Observed on `main` at `f04f9d3` (2026-10-17). Re-check them when work resumes.

| Area | Today | Why it matters |
| --- | --- | --- |
| Cart cookie | `cart` = `{v: 2, items: {cartKey: qty}}`, httpOnly, unsigned, 30 days. `cartKey` = `prod_…[:var_…][#xtra_…,…]` (`src/features/cart/cart.ts`, `key.ts`) | There is no place for a per-line amount, and the key cannot tell apart two lines of the same product with different amounts |
| Price authority | The server always recomputes `unitPriceCents = lineUnitPriceCents(product.price_cents, variant, extras)` from D1, for both form and JSON checkout (`src/pages/api/checkout.ts`) | Benefit Mode introduces the first client-supplied amount: a new trust boundary |
| Prices | `products.price_cents` and `product_variants.price_cents` (a variant's full price); `product_extras.price_delta_cents` added on top | Natural carriers for product and variant minimums; extras need a decision |
| Stock | `stock INTEGER NOT NULL DEFAULT 0` on products and variants; no "unlimited" concept; checkout holds stock through `features/orders/reservations.ts` | Gratitude needs a non-inventory item that never reserves stock |
| Shipping | `products.requires_shipping`, `weight_grams`; shipping zones in config | Gratitude: `requires_shipping = 0` already exists |
| Digital goods | `products.file_key` / `file_name` and downloads at `/order/[token]/download/…` | Gratitude must never have a file |
| Order snapshot | `order_items.price_cents`, `name`, `variant_id`; Stripe metadata carries a compact items list `{id, q, n, p, v}`; Lightning keeps a JSON snapshot in `pending_payments.items` | The minimum must be added to every snapshot; Stripe metadata values are size-limited |
| Stripe | `price_data.unit_amount` per line; optional promotion codes (`discounts`) and `automatic_tax` | Discounts and tax on contributions need explicit rules |
| Refunds | Amount-based per order (`refunded_cents`, provider/external split) | Compatible with one amount per contribution |
| Other entry points | Express "buy now" (`/express`), JSON `POST /api/checkout` with `{items}`, MCP `create_checkout` tool, `/api/products` exposing `price` | Each must accept or explain an amount |
| SEO | Product JSON-LD `Offer` with `price` | In Benefit Mode the price is a minimum |

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

- Amount per unit or per line when quantity > 1?
- Extras in benefit mode: raise the minimum, or disabled?
- Promotion codes in benefit mode: always off, or allowed on shipping only?
- What fiscal document must Associazione Voltare Pagina ETS issue, and does it
  require item and contribution data that Stripe receipts do not carry?
- Receipt numbering: one series per year or continuous? Reset rules?
- Which supporter data is required on the receipt (name, address, tax code),
  and how is it collected without burdening supporters who don't need it?
- How is a refund documented: cancellation of the receipt, a correction
  notice, or a reissue under a new number?
- How long must issued receipts be retained?
- Default safety cap for a single contribution?
- Should Benefit Mode be allowed per product (mixed catalog) rather than
  store-wide? The current decision is store-wide (`commerceMode`).
- Crowdfunding (R13): campaign selection by category, explicit list, or
  both? Can one contribution count in several campaigns?
- Crowdfunding (R13): does the total include the full contribution or only
  what exceeds the perk's cost? Is it available in standard mode?
- Crowdfunding (R13): which supporter data may be published, and for how long
  after the campaign ends?

## Resumption protocol

1. Confirm explicit authorization to start Benefit Mode.
2. Review the completed i18n architecture (routing, mountPath, URL builders,
   dictionaries, per-locale settings) and update the facts table above.
3. Re-check every "Current architecture" fact against `main`.
4. Resolve the open questions and record the decisions here.
5. Only then create a development branch.

Production note, independent of Benefit Mode: before any production deploy,
the public checkout must show only payment methods that are enabled AND
operational, and demo checkout must be explicitly disabled on the Monopolele
and L'Altracittà stores. This is tracked in the i18n design document.
