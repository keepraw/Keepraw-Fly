const pluralSuffix = /_(zero|one|two|few|many|other)$/;

export function flattenResource(
  resource: unknown,
  prefix = "",
): Map<string, string> {
  if (!resource || typeof resource !== "object" || Array.isArray(resource))
    throw new Error(`Invalid resource object: ${prefix || "root"}`);
  const leaves = new Map<string, string>();
  for (const [key, value] of Object.entries(resource)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      if (!value.trim()) throw new Error(`Empty translation: ${path}`);
      const withoutInterpolations = value.replace(/{{\s*\w+\s*}}/g, "");
      if (/{{|}}/.test(withoutInterpolations))
        throw new Error(`Malformed interpolation: ${path}`);
      leaves.set(path, value);
    } else {
      for (const [child, text] of flattenResource(value, path))
        leaves.set(child, text);
    }
  }
  if (!leaves.size)
    throw new Error(`Empty resource object: ${prefix || "root"}`);
  return leaves;
}

function parameters(values: string[]): string {
  return [
    ...new Set(
      values.flatMap((value) =>
        [...value.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]),
      ),
    ),
  ]
    .sort()
    .join(",");
}

function logicalKeys(leaves: Map<string, string>): Map<string, string[]> {
  const keys = new Map<string, string[]>();
  for (const [key, value] of leaves) {
    const logical = key.replace(pluralSuffix, "");
    keys.set(logical, [...(keys.get(logical) ?? []), value]);
  }
  return keys;
}

/** English dialect overrides are partial; other released languages are complete. */
export function checkResource(
  base: unknown,
  target: unknown,
  locale: string,
  partial = false,
): string[] {
  const expectedLeaves = flattenResource(base);
  const leaves = flattenResource(target);
  const expected = logicalKeys(expectedLeaves);
  const actual = logicalKeys(leaves);
  const issues: string[] = [];
  for (const key of actual.keys())
    if (!expected.has(key)) issues.push(`Unknown key: ${key}`);
  for (const [key, texts] of expected) {
    const translations = actual.get(key);
    if (!translations) {
      if (!partial) issues.push(`Missing key: ${key}`);
      continue;
    }
    // A literal singular may omit count; all other parameters must agree.
    const expectedParams = parameters(texts);
    if (parameters(translations) !== expectedParams)
      issues.push(`Interpolation mismatch: ${key}`);
    for (const [leaf, value] of leaves) {
      if (leaf.replace(pluralSuffix, "") !== key) continue;
      const ownParams = parameters([value]);
      if (
        ownParams !== expectedParams &&
        !(
          leaf.endsWith("_one") &&
          expectedParams
            .split(",")
            .filter((name) => name !== "count")
            .join(",") === ownParams
        )
      )
        issues.push(`Interpolation mismatch: ${leaf}`);
    }
    const plural = [...expectedLeaves.keys()].some(
      (leaf) =>
        pluralSuffix.test(leaf) && leaf.replace(pluralSuffix, "") === key,
    );
    if (!plural) continue;
    const categories = new Intl.PluralRules(locale).resolvedOptions()
      .pluralCategories;
    for (const category of categories) {
      // i18next permits an unsuffixed translation for languages with only other.
      if (
        !leaves.has(`${key}_${category}`) &&
        !(categories.length === 1 && category === "other" && leaves.has(key))
      )
        issues.push(`Missing plural: ${key}_${category}`);
    }
  }
  return issues;
}
