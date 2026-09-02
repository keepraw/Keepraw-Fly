export function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase();
}
