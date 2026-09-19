export class CollectorNumber {
  private constructor(private readonly value: string) {}

  static from(raw: string): CollectorNumber {
    const value = raw.trim();
    if (value === "") {
      throw new Error(`Invalid collector number: ${raw}`);
    }
    return new CollectorNumber(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: CollectorNumber): boolean {
    return this.value === other.value;
  }
}
