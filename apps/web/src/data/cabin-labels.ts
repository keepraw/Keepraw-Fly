/** The translation key of a canonical cabin value; other text is shown as recorded. */
export function cabinTranslationKey(cabin: string): string | undefined {
  if (cabin === "economy") return "flightEditor.cabins.economy";
  if (cabin === "premium economy") return "flightEditor.cabins.premiumEconomy";
  if (cabin === "business") return "flightEditor.cabins.business";
  if (cabin === "first") return "flightEditor.cabins.first";
  return undefined;
}
