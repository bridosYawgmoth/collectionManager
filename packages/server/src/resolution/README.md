# Resolution

Spoken string to ranked candidates. A pure domain service with the catalog behind a port, so the accuracy fixture suite runs with zero I/O.

Scoring (Double Metaphone, Levenshtein, confidence) stays in TypeScript. `pg_trgm` is a coarse SQL prefilter only — it does not decide identity.

Cascade, in order: normalized exact → alias table → phonetic (Double Metaphone) → trigram/edit distance. LLM tiebreak is out of scope (cost). The last local step is the last step for now: ambiguous or low-confidence results stay pending confirmation later and must not mutate Collection.

Accuracy is a committed number. Run `pnpm test:resolver-eval` (or `pnpm --filter server test:resolver-eval`). The suite uses a fixture catalog of targets plus distractors, not the 38k production ingest.

`ResolveSpokenName` can inject a `pg_trgm` prefilter after phonetic miss; TypeScript still ranks the subset. Phonetic cases like "ether eyes" are below the SQL similarity threshold on purpose.
