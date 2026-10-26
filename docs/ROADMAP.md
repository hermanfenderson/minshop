# Roadmap

Planned work on the `hermanfenderson/minshop` fork, in order. Each item is a
reusable Minshop feature or a deployment step; nothing here is specific to one
store in the code.

| # | Item | Status |
|---|---|---|
| 1 | Test shop on Cloudflare, Stripe only (Monopolele, step 1) | Done 2026-10-26 — [report](SHOP_TEST_MONOPOLELE.md) |
| 2 | Failed and pending payment follow-up (below) | Planned — before production |
| 3 | Printful connector and WooCommerce catalog import (Monopolele, step 2) | In progress — catalog import done |
| 4 | `monopolele` theme (below) | Before production, after the connector |
| 4a | Two-axis variant picker (below) | Before production |
| 5 | Production instance — includes Turnstile (below) | After the connector is tested |
| 6 | Benefit Mode | [Specification](ROADMAP_BENEFIT_MODE.md) |

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

Minshop has one variant group per product, so the WooCommerce import turns
color × size into a single list ("Black / M"): 20 entries on a t-shirt with
four colors and five sizes. Wanted (Mauro, 2026-10-26): pick the color, then
the size, with the photo following the color and unavailable combinations
disabled. Server-rendered, so it must still work without JavaScript; the
variants stay rows of `product_variants`, with the axes stored per variant.

## Production checklist items

- **Turnstile** on admin login and customer sign-in: a free widget in the
  Cloudflare dashboard, sitekey and secret in Admin → Settings → Bot
  protection. Required once customer accounts are on, since every sign-in
  request sends an email.
- The rest of the checklist is in the [test shop report](SHOP_TEST_MONOPOLELE.md#checklist-per-la-produzione).
