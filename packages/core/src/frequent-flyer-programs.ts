import type { FrequentFlyerMembership } from "@keepraw-fly/schema";
import type { SupportedLocale } from "./reference-data";

export interface FrequentFlyerProgram {
  id: string;
  names: Record<SupportedLocale, string>;
  alliance?: string;
}

const programs: readonly FrequentFlyerProgram[] = [
  { id: "phoenixmiles", names: { en: "PhoenixMiles", "zh-CN": "凤凰知音", "zh-TW": "鳳凰知音" }, alliance: "Star Alliance" },
  { id: "mileageplus", names: { en: "MileagePlus", "zh-CN": "前程万里", "zh-TW": "前程萬里" }, alliance: "Star Alliance" },
  { id: "aadvantage", names: { en: "AAdvantage", "zh-CN": "AAdvantage", "zh-TW": "AAdvantage" }, alliance: "oneworld" },
  { id: "skymiles", names: { en: "SkyMiles", "zh-CN": "飞凡里程常客计划", "zh-TW": "飛凡里程常客計劃" }, alliance: "SkyTeam" },
];

const programById = new Map(programs.map((program) => [program.id, program]));

export function frequentFlyerProgramById(id: string): FrequentFlyerProgram | undefined {
  return programById.get(id);
}

export function frequentFlyerProgramName(membership: FrequentFlyerMembership, locale: SupportedLocale): string {
  return programById.get(membership.programId)?.names[locale]
    ?? membership.programName
    ?? membership.programId;
}

export function frequentFlyerProgramId(value: string): string {
  const trimmed = value.trim();
  const known = programs.find((program) => Object.values(program.names)
    .some((name) => name.toLocaleLowerCase() === trimmed.toLocaleLowerCase()));
  if (known) return known.id;
  const slug = trimmed.toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "custom";
}
