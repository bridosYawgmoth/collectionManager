# collectionManager

A voice-first Magic: The Gathering collection manager. Talk to your phone while you sort cards; the app resolves what you said to a specific printing and keeps its own collection database, syncing out to Archidekt on command.

## Why it owns its own data

No MTG collection platform offers a usable write API. Moxfield requires a Cloudflare clearance cookie even for public deck reads, ManaBox has no API at all, and Deckbox has promised one since 2014. Archidekt is the most open of them, but its collection endpoints are undocumented and can change without notice.

What every platform *does* support is CSV import and export keyed on **Scryfall ID**. So this project keeps its own Postgres database as the source of truth and treats each platform as a sync target behind one port. Archidekt breaking cannot corrupt your collection.

Voice input also needs state no third-party API models: confidence scores per entry, a pending-confirmation queue, and an undo log. A misheard card is a row you fix before it ever syncs out.

## How it works

```
mic -> speech to text -> intent extraction -> card resolution -> confirm -> collection -> sync
```

Two rules shape the whole design:

**The language model extracts, the resolver identifies.** Intent extraction returns only the spoken string and a quantity, never a card name. Asking a model to name a card reintroduces hallucination exactly where the system cannot tolerate it. Identity is decided solely by matching against a local Scryfall index.

**Text first, voice as an adapter.** Everything flows through a single text command endpoint, so the entire pipeline is testable without a microphone, and typing remains a fallback for cards that simply will not transcribe.

## The hard part is card identity

Speech recognition is a cheap commodity. The risk is *entity* error on proper nouns, and Magic names are adversarial: `Ætherize` transcribes as "ether eyes", `Urza's Saga` as "ursa's saga", `Lim-Dûl's Vault` as "lim dools vault". None of those share a prefix with the real name, so ordinary fuzzy search fails.

Resolution is therefore a scored cascade — normalized exact match, a hand-curated alias table for slang like "goyf", a Double Metaphone phonetic index, trigram similarity, and a language-model tiebreak only when the top candidates are close. Anything below the confidence threshold becomes a confirmation card showing the card image and expansion symbol rather than a silent guess.

Accuracy is a committed number with a fixture suite of real transcription failures, not a vibe.

## Stack

TypeScript end to end. Fastify and Postgres on the server, React as an installable PWA on the phone. Five bounded contexts with layering applied where it earns its keep. See `.cursor/rules/` for the conventions.

## Status

Early. Project conventions and secret controls are in place; the catalog and resolver come next.

## Credits

Card data from [Scryfall](https://scryfall.com). Collection sync with [Archidekt](https://archidekt.com). Magic: The Gathering is a trademark of Wizards of the Coast; this project is unaffiliated.
