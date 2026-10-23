import { shareGraphemes } from "../share/share-text";

/** A local souvenir identity, deliberately separate from the flight archive. */
export interface PassportProfile {
  /** Legacy nickname retained for lossless storage migration; Settings owns names. */
  name: string;
  /** Opaque local souvenir identity, never used as a TD3 document number. */
  id: string;
  /** Stable nine-character display number, shared with the MRZ encoder. */
  number: string;
}

export const PASSPORT_PROFILE_KEY = "keepraw-fly.passport-profile.v1";
export const PASSPORT_NAME_LIMIT = 32;
let sessionProfile: PassportProfile | undefined;

export function normalizePassportName(value: string): string {
  return shareGraphemes(
    value
      .normalize("NFC")
      .replace(
        /[\p{Cc}\u200B\u200E\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/gu,
        "",
      )
      .replace(/\s+/gu, " ")
      .trim(),
  )
    .slice(0, PASSPORT_NAME_LIMIT)
    .join("");
}

function validProfile(
  value: unknown,
): value is { name: string; number: string; id?: string } {
  if (!value || typeof value !== "object") return false;
  const profile = value as PassportProfile;
  return (
    typeof profile.name === "string" &&
    (profile.id === undefined
      ? /^KRF-[A-F0-9]{16}$/.test(profile.number)
      : /^KRF-[A-F0-9]{16}$/.test(profile.id) &&
        profile.number === souvenirDocumentNumber(profile.id))
  );
}

/** A deliberate short-number design, using all 64 identity bits rather than
 * taking a substring of the old ID. 36^9 values (~46.5 bits), scoped to this
 * local keepsake; no global registry or guarantee of worldwide uniqueness. */
export function souvenirDocumentNumber(id: string): string {
  if (!/^KRF-[A-F0-9]{16}$/.test(id)) throw new Error("Invalid souvenir ID");
  return (BigInt(`0x${id.slice(4)}`) % 36n ** 9n)
    .toString(36)
    .toUpperCase()
    .padStart(9, "0");
}

/** Read before rendering. No document IDs or personal data seed the number.
 * If storage is unavailable, retain the identity for this session and report it. */
export function loadPassportProfile(): {
  profile: PassportProfile;
  persisted: boolean;
} {
  try {
    const raw = localStorage.getItem(PASSPORT_PROFILE_KEY);
    const stored: unknown = raw ? JSON.parse(raw) : null;
    if (validProfile(stored)) {
      const id = stored.id ?? stored.number;
      sessionProfile = {
        name: stored.name,
        id,
        number: souvenirDocumentNumber(id),
      };
      return {
        profile: sessionProfile,
        persisted: stored.id ? true : savePassportProfile(sessionProfile),
      };
    }
  } catch {
    /* Keep the session identity when storage is blocked or malformed. */
  }
  if (!sessionProfile) {
    const id = `KRF-${Array.from(
      crypto.getRandomValues(new Uint32Array(2)),
      (part) => part.toString(16).padStart(8, "0"),
    )
      .join("")
      .toUpperCase()}`;
    sessionProfile = {
      name: "",
      id,
      number: souvenirDocumentNumber(id),
    };
  }
  return {
    profile: sessionProfile,
    persisted: savePassportProfile(sessionProfile),
  };
}

export function savePassportProfile(profile: PassportProfile): boolean {
  if (!validProfile(profile)) return false;
  const normalized = {
    name: profile.name,
    id: profile.id,
    number: profile.number,
  };
  sessionProfile = normalized;
  try {
    localStorage.setItem(PASSPORT_PROFILE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}
