---
name: scryfall-refresh
description: Re-ingests Scryfall bulk data, rebuilds the phonetic and trigram indexes, and reports new sets and card count deltas. Use when card data is stale, a new set has released, a card fails to resolve because it is too new, or the user asks to update the catalog.
disable-model-invocation: true
---

# Scryfall refresh

## Run

```bash
pnpm --filter server scryfall:refresh
```

Downloads the current `oracle_cards` and `default_cards` bulk files, upserts `cards` and `printings`, then rebuilds the Double Metaphone and `pg_trgm` indexes.

## What it must respect

Per `third-party-citizenship.mdc`: bulk download only, descriptive `User-Agent`, and no per-card API loop. Resolve the download URL from `https://api.scryfall.com/bulk-data` rather than hardcoding a path — Scryfall rotates the file URLs.

## Verify afterwards

1. Card and printing counts moved in the expected direction. They should never shrink.
2. Run the `resolver-eval` skill. An index rebuild can shift accuracy.
3. Spot-check that a card from the newest set resolves.

## Reporting

State the new set codes, the card count delta, and resolver accuracy before and after. A silent refresh that quietly changed accuracy is the failure mode to avoid.
