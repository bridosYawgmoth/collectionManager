---
name: add-sync-target
description: Implements a new collection manager sync adapter behind CollectionTargetPort, covering CSV column mapping, Scryfall ID handling, and round-trip tests. Use when adding support for exporting to or importing from another platform such as ManaBox, Moxfield, Deckbox, or TCGplayer.
disable-model-invocation: true
---

# Add a sync target

Every target implements the same port, which is what keeps cross-platform sync almost free. Work in `packages/server/src/sync/`.

## Checklist

```
- [ ] Confirm the platform's real CSV columns from its own docs or an actual export
- [ ] Add the adapter in sync/infrastructure/ implementing CollectionTargetPort
- [ ] Map to and from Scryfall ID
- [ ] Round-trip test: export then re-import yields identical entries
- [ ] Test the ambiguous-printing and unknown-card paths
- [ ] Register the target and expose it to the sync command
```

## Non-negotiable

**Scryfall ID is the mapping key.** Where a platform accepts it, use it and nothing else. Name-plus-set matching is a fallback only for platforms that cannot take an ID, and it must record ambiguity rather than silently pick a printing.

## Known column shapes

Verify these before trusting them; they drift.

- **Archidekt** — flexible columns, accepts Scryfall ID
- **ManaBox** — tab-delimited, has `Scryfall ID` and `Binder Name`
- **Moxfield** — `Count`, `Tradelist Count`, `Edition`
- **Deckbox** — full set *names* rather than codes, single-letter conditions

## Read-only by default

A new target ships with `exportCsv` only. Adding `push` means writing into someone's account over an unofficial API, so it needs the user's explicit go-ahead and must degrade safely per `third-party-citizenship.mdc`.
