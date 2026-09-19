-- cards: oracle identity the resolver will match against.
-- Without this table there is no local index and spoken names cannot
-- be identified without calling Scryfall per card.
CREATE TABLE cards (
  oracle_id uuid PRIMARY KEY,
  name text NOT NULL,
  name_normalized text NOT NULL,
  layout text NOT NULL,
  type_line text NOT NULL,
  mana_cost text NOT NULL,
  oracle_text text NOT NULL,
  color_identity text[] NOT NULL DEFAULT '{}',
  cmc numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- printings: one row per Scryfall ID, the only cross-system key.
-- image_uris and set_icon_svg_uri store URLs, never image bytes.
CREATE TABLE printings (
  scryfall_id uuid PRIMARY KEY,
  oracle_id uuid NOT NULL REFERENCES cards (oracle_id),
  set_code text NOT NULL,
  set_name text NOT NULL,
  collector_number text NOT NULL,
  rarity text NOT NULL,
  finishes text[] NOT NULL,
  lang text NOT NULL,
  image_uris jsonb NOT NULL DEFAULT '{}'::jsonb,
  set_icon_svg_uri text,
  prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  released_at date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX printings_oracle_id_idx ON printings (oracle_id);
CREATE INDEX printings_set_code_idx ON printings (set_code);

-- GIN trigram index: coarse name prefilter for the later resolver.
-- Without it a spoken-name lookup would sequential-scan ~30k rows.
CREATE INDEX cards_name_normalized_trgm
  ON cards
  USING gin (name_normalized gin_trgm_ops);
