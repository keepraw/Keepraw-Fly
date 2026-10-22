import { shareGraphemes } from "../share/share-text";

/** A local souvenir identity, deliberately separate from the flight archive. */
export interface PassportProfile {
  name: string;
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

function validProfile(value: unknown): value is PassportProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as PassportProfile;
  return (
    typeof profile.name === "string" &&
    /^KRF-[A-F0-9]{16}$/.test(profile.number)
  );
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
      sessionProfile = {
        name: normalizePassportName(stored.name),
        number: stored.number,
      };
      return { profile: sessionProfile, persisted: true };
    }
  } catch {
    /* Keep the session identity when storage is blocked or malformed. */
  }
  sessionProfile ??= {
    name: "",
    number: `KRF-${Array.from(
      crypto.getRandomValues(new Uint32Array(2)),
      (part) => part.toString(16).padStart(8, "0"),
    )
      .join("")
      .toUpperCase()}`,
  };
  return {
    profile: sessionProfile,
    persisted: savePassportProfile(sessionProfile),
  };
}

export function savePassportProfile(profile: PassportProfile): boolean {
  if (!validProfile(profile)) return false;
  const normalized = {
    name: normalizePassportName(profile.name),
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
