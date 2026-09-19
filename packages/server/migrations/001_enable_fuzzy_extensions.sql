-- pg_trgm: coarse name prefilter via trigram similarity (GIN index lands
-- with the catalog tables). fuzzystrmatch: ships metaphone/levenshtein
-- primitives for SQL diagnostics, not for scoring.
-- Scoring (Double Metaphone, Levenshtein, confidence) stays in the
-- TypeScript resolution domain so the fixture suite runs with zero I/O.
-- Without these extensions a later catalog query cannot prefilter ~30k
-- names in Postgres and would scan in application memory only.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
