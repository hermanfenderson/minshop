# i18n engine

A small, dependency-free translation and locale-routing engine. Everything in
this folder is pure TypeScript: it imports no Cloudflare runtime, no Astro
module, no config, and no feature code. `engine-boundary.test.ts` enforces
that. Settings arrive as plain values; the runtime glue (reading D1 settings,
the middleware step) lives outside, in `src/features/i18n/`.

The design is in the i18n architecture document (version 2). This folder holds
the foundations: formatting, translation, the language registry, dictionaries,
and routing.

## Credits

The formatter (`format.ts`), the typed per-area catalogs, and the English-keyed
`MessageKey` approach come from
[ddyy/minshop#60](https://github.com/ddyy/minshop/pull/60) by Luca G.
([@lgibelli](https://github.com/lgibelli)). This engine generalizes that work
from one build-time store language to any number of runtime languages.

## Languages

- **Supported** languages are in the registry (`locales.ts`): code, native
  name, Intl tag, text direction, fallbacks. Upstream bundles `en` and `it`; a
  clone adds more with `createLocaleRegistry()`.
- **Enabled** languages and the **default** language are runtime settings
  (`settings.ts`), chosen in the admin.
- Codes are lowercase BCP 47: `en`, `it`, `pt-br`.

## Dictionaries

Catalogs live in `messages/<locale>/<area>.ts`. Every key is `area.name`.
English is the source: its keys are the `MessageKey` type, so an unknown key
fails `astro check`.

- A message is a string with `{param}` placeholders, or CLDR plural forms
  chosen by `params.count`: `{ one: '{count} item', other: '{count} items' }`.
  Italian needs `one`, `many`, `other`.
- A missing key falls back along the language's chain (`pt-br` → `pt` → …),
  then English. It renders, so it is reported as coverage, not an error.
- A wrong placeholder, a missing plural form, or a key English doesn't have is
  an error: `catalog.test.ts` fails.
- Markup inside a sentence: keep it in the message and use `th()`, which
  HTML-escapes every param (catalogs are trusted source).

Dictionaries hold interface text only. Product names, pages, and menus are
editorial content: they live in D1, not here.

## Formatting

`i18n.money()`, `i18n.number()`, and `i18n.date()` format in the language's
Intl tag. The underlying `formatMoney()`, `formatNumber()`, and
`formatTimestamp()` default to `en-US`, so code that passes no locale renders
exactly as before.

## Adding a language

1. Add a `messages/<code>/` folder with its `index.ts`, typed as `Catalog`.
2. Register it: upstream in `BUILTIN_LOCALES` and `BUNDLED_CATALOGS`; a clone
   through `createLocaleRegistry()` with its own catalogs.
