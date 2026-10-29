# Roadmap

Planned work on the `hermanfenderson/minshop` fork, in order. Each item is a
reusable Minshop feature or a deployment step; nothing here is specific to one
store in the code.

| # | Item | Status |
|---|---|---|
| 1 | Test shop on Cloudflare, Stripe only (Monopolele, step 1) | Done 2026-10-26 — [report](SHOP_TEST_MONOPOLELE.md) |
| 2 | Failed and pending payment follow-up (below) | Done 2026-10-27 — tested on the test shop |
| 3 | Printful connector and WooCommerce catalog import (Monopolele, step 2) | Drafts and live shipping rates done (2026-10-27). Shipped/tracking webhooks: row 7 |
| 4 | Benefit Mode | **Next** — authorized 2026-10-27; it moves donations off WordPress. [Specification](ROADMAP_BENEFIT_MODE.md) |
| 5 | `monopolele` theme (below) | After Benefit Mode |
| 5a | Two-axis variant picker (below) | Done 2026-10-26 (option A) |
| 6 | Production instance — includes Turnstile (below) | After Benefit Mode and the theme |
| 7 | Printful shipped/tracking webhooks | Built 2026-10-29 (`feat/benefit-mode`): webhook registered from Admin, read-back from Printful's API, `order_shipments` (0048), first package fulfils the order and sends the shipped email, cron read-back as fallback. Real shipment pending: the first confirmed production order |

## Failed and pending payment follow-up

Found while testing the Monopolele test shop (2026-10-26). Orders are
paid-only, so a payment that never settles leaves no order, only a checkout
reservation that Admin does not show. With delayed methods (SEPA Direct Debit)
the failure arrives days after checkout, when the buyer has closed the page:
today neither the buyer nor the merchant learns about it.

1. **Buyer email** when a delayed payment fails: no order was placed, nothing
   was charged, and how to try again. Sent from
   `checkout.session.async_payment_failed`, in the checkout's language, through
   the existing email outbox (retried by the cron).
2. **Merchant alert** to the new-order notification address for the same event.
3. **Admin view** of failed, expired and still-processing checkouts — read-only:
   buyer email, items, amount, method, date, state — so the merchant can follow
   up. The data is already in `checkout_reservations`; abandoned checkouts with
   no email stay out.

Already done: the order page says when a payment failed, expired or is still
clearing (it used to say "your payment went through" in every case).

Done 2026-10-27: migration `0042` stores the buyer email, amount, currency and
locale on the reservation as Stripe reports them, and adds a
`checkout_notifications` outbox (same state machine as `order_notifications`,
swept by the cron). Both emails go out once per failed checkout; the admin list
is at `/admin/orders/unpaid`, linked from Orders.

## `monopolele` theme

A store-owned theme (`src/themes/monopolele/`) so the shop looks like
monopolele.com, built after the connector so it is checked against the real
WooCommerce photos and descriptions; tried on the test shop first.

- Tokens (colors, fonts, radii) and logo only from the approved files of the
  festival's graphics page.
- Header and footer reproduce the site's (menu, logo, EN/IT switch), linking
  back to monopolele.com pages. They are a copy: a menu change on the site must
  be repeated here until a shared header/footer package is worth building.
- Catalog and product pages keep Minshop's structure, restyled.
- The site shows the cart count from the `minshop_cart_n` cookie once both are
  on the same host. L'Altracittà gets its own theme; the core stays neutral.

## Two-axis variant picker

Minshop has one variant group per product, so the WooCommerce import turned
color × size into a single list ("Black / M"): 20 entries on a t-shirt with
four colors and five sizes. Done 2026-10-26 without a schema change (option
A): a group named `Color / Size` whose labels all split the same way shows one
selector per axis (`src/features/products/variantAxes.ts`); the variant row
stays the unit of price, stock and image. Without JavaScript the form posts
the axis choices and the server maps them back to the variant.

Later, if translating ~170 labels one by one gets heavy (option B): options
and values as real rows, so "Black" is translated once, with a two-axis
editor in the admin.

## Production checklist items

- **Turnstile** on admin login and customer sign-in: a free widget in the
  Cloudflare dashboard, sitekey and secret in Admin → Settings → Bot
  protection. Required once customer accounts are on, since every sign-in
  request sends an email.
- The rest of the checklist is in the [test shop report](SHOP_TEST_MONOPOLELE.md#checklist-per-la-produzione).
