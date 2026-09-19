const SET_CODE_PATTERN = /^[a-z0-9]{2,10}$/;

export class SetCode {
  private constructor(private readonly value: string) {}

  static from(raw: string): SetCode {
    const value = raw.trim().toLowerCase();
    if (!SET_CODE_PATTERN.test(value)) {
      throw new Error(`Invalid set code: ${raw}`);
    }
    return new SetCode(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: SetCode): boolean {
    return this.value === other.value;
  }
}
