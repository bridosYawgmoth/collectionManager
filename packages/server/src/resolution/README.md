# Resolution

Spoken string to ranked candidates. A pure domain service with the catalog behind a port, so the accuracy fixture suite runs with zero I/O.

Scoring (Double Metaphone, Levenshtein, confidence) stays in TypeScript. `pg_trgm` is a coarse SQL prefilter only — it does not decide identity.
