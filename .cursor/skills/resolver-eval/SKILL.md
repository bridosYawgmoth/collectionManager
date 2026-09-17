---
name: resolver-eval
description: Runs the card resolution accuracy fixture suite and reports per-stage accuracy against the committed baseline. Use when changing anything in the resolution context, adding aliases, tuning confidence thresholds, or when the user asks how accurate the resolver is.
disable-model-invocation: true
---

# Resolver evaluation

The resolver turns a mangled speech transcript into a specific card. Its accuracy is a committed number, not a vibe.

## Run

```bash
pnpm --filter server test:resolver-eval
```

Reports overall accuracy, per-stage hit counts (normalized exact, alias, phonetic, trigram, LLM tiebreak), and a diff against `packages/server/src/resolution/__fixtures__/baseline.json`.

## Reading the output

- **Regression** (accuracy below baseline): report which fixtures newly fail and why, before changing anything else. Do not raise the baseline to make it pass.
- **Improvement**: update the baseline in the same commit and state the old and new numbers in the commit body.
- **Stage shift with flat accuracy**: still worth flagging. Cases moving from exact to phonetic means normalization behavior changed.

## Adding fixtures

Each case should be a real transcription failure, not an invented typo:

```json
{ "spoken": "ether eyes", "expect": "Ætherize", "note": "STT phonetic, no shared prefix" }
```

Add fixtures when you hit a genuine miss while using the app. That is what keeps this suite representative rather than synthetic.

## Do not

- Never adjust a confidence threshold just to pass a fixture without reporting the tradeoff. Thresholds trade silent wrong answers against confirmation fatigue, and that is a product decision.
- Never add a fixture whose fix leaves the baseline unchanged — if the number did not move, the fixture was already passing.
