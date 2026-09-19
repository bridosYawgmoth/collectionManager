export interface CardAlias {
  readonly spoken: string;
  readonly name: string;
}

// DEFAULT_CARD_ALIASES: slang the user actually says. Start small and
// unambiguous — a wrong alias silently mis-identifies a card. Without this
// table, "bolt" would fall through to phonetic/trigram instead of Lightning Bolt.
export const DEFAULT_CARD_ALIASES: readonly CardAlias[] = [
  { spoken: "bolt", name: "Lightning Bolt" },
  { spoken: "goyf", name: "Tarmogoyf" },
  { spoken: "fow", name: "Force of Will" },
  { spoken: "swords", name: "Swords to Plowshares" },
  { spoken: "path", name: "Path to Exile" },
  { spoken: "snappy", name: "Snapcaster Mage" },
  { spoken: "bob", name: "Dark Confidant" },
  { spoken: "nado", name: "Cyclonic Rift" },
];
