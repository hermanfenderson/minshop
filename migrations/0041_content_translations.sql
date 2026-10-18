-- 0041: editorial content in other languages.
--
-- The main tables keep holding the store's content in its source language
-- (the i18n_content_source_locale setting). Each other language lives in a
-- parallel, typed table per entity, keyed by (entity id, locale). Commercial
-- data — prices, stock, SKUs, weights, status — has no column here: it is shared
-- by every language because it exists once, on the main row.
--
-- Columns are nullable field by field. NULL means "not translated": the
-- storefront falls back to the source text for that field alone. An empty
-- string is a deliberate empty value in that language (a description or an
-- image alt left blank on purpose) and is shown as such.
--
-- `slug` columns are reserved: slugs are shared across languages in the first
-- version, and nothing reads them yet.
--
-- `origin` and `content_hash` serve the future Markdown/YAML sync ('admin' =
-- written in the dashboard, 'file' = imported; the hash of the last import),
-- so a sync can tell an admin edit from its own. Nothing writes 'file' yet.
--
-- D1 enforces foreign keys, so deleting a product, variant, extra, image,
-- category, page or menu item removes its translations with it.

CREATE TABLE IF NOT EXISTS product_translations (
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  locale        TEXT    NOT NULL,
  name          TEXT,
  description   TEXT,
  variant_label TEXT,
  slug          TEXT,
  origin        TEXT    NOT NULL DEFAULT 'admin' CHECK (origin IN ('admin', 'file')),
  content_hash  TEXT,
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (product_id, locale)
);

CREATE TABLE IF NOT EXISTS product_variant_translations (
  variant_id   INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  locale       TEXT    NOT NULL,
  label        TEXT,
  origin       TEXT    NOT NULL DEFAULT 'admin' CHECK (origin IN ('admin', 'file')),
  content_hash TEXT,
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (variant_id, locale)
);

CREATE TABLE IF NOT EXISTS product_extra_translations (
  extra_id     INTEGER NOT NULL REFERENCES product_extras(id) ON DELETE CASCADE,
  locale       TEXT    NOT NULL,
  label        TEXT,
  origin       TEXT    NOT NULL DEFAULT 'admin' CHECK (origin IN ('admin', 'file')),
  content_hash TEXT,
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (extra_id, locale)
);

CREATE TABLE IF NOT EXISTS product_image_translations (
  image_id     INTEGER NOT NULL REFERENCES product_images(id) ON DELETE CASCADE,
  locale       TEXT    NOT NULL,
  alt          TEXT,
  origin       TEXT    NOT NULL DEFAULT 'admin' CHECK (origin IN ('admin', 'file')),
  content_hash TEXT,
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (image_id, locale)
);

CREATE TABLE IF NOT EXISTS category_translations (
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  locale       TEXT    NOT NULL,
  name         TEXT,
  slug         TEXT,
  origin       TEXT    NOT NULL DEFAULT 'admin' CHECK (origin IN ('admin', 'file')),
  content_hash TEXT,
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (category_id, locale)
);

CREATE TABLE IF NOT EXISTS page_translations (
  page_id       INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  locale        TEXT    NOT NULL,
  title         TEXT,
  body_markdown TEXT,
  slug          TEXT,
  origin        TEXT    NOT NULL DEFAULT 'admin' CHECK (origin IN ('admin', 'file')),
  content_hash  TEXT,
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (page_id, locale)
);

CREATE TABLE IF NOT EXISTS menu_item_translations (
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  locale       TEXT    NOT NULL,
  label        TEXT,
  origin       TEXT    NOT NULL DEFAULT 'admin' CHECK (origin IN ('admin', 'file')),
  content_hash TEXT,
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (menu_item_id, locale)
);

-- Keyword search in other languages: an index over the translated product
-- texts, kept in sync by triggers like products_fts (0003). Diacritics are
-- folded so "caffe" finds "caffè". Same export gotcha as products_fts: drop it,
-- export, recreate.
CREATE VIRTUAL TABLE IF NOT EXISTS product_translations_fts USING fts5(
  name,
  description,
  content='product_translations',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS product_translations_fts_ai AFTER INSERT ON product_translations BEGIN
  INSERT INTO product_translations_fts(rowid, name, description)
    VALUES (new.rowid, new.name, new.description);
END;

CREATE TRIGGER IF NOT EXISTS product_translations_fts_ad AFTER DELETE ON product_translations BEGIN
  INSERT INTO product_translations_fts(product_translations_fts, rowid, name, description)
    VALUES ('delete', old.rowid, old.name, old.description);
END;

CREATE TRIGGER IF NOT EXISTS product_translations_fts_au AFTER UPDATE ON product_translations BEGIN
  INSERT INTO product_translations_fts(product_translations_fts, rowid, name, description)
    VALUES ('delete', old.rowid, old.name, old.description);
  INSERT INTO product_translations_fts(rowid, name, description)
    VALUES (new.rowid, new.name, new.description);
END;
