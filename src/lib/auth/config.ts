// Preset plant logins = the same three roles as the topbar persona switcher
// (GM, Owner, Operator). User picks a role on /login and enters that role's
// password. Auth is always on — no env flag required.
//
// The built-in secret and passwords below are PUBLIC — they are in the repo.
// Anyone with a checkout can mint a signed session for any role against a
// deployment still using them, which makes every capability check downstream
// decorative. They exist so a fresh clone runs; they are not credentials.
//
// So in production these are refused rather than silently used
// (`assertProductionSecrets`). Failing closed is deliberate: a plant that
// forgets MOID_AUTH_SECRET gets a loud, named error instead of a quality
// system anyone can sign into as GM. Set MOID_ALLOW_DEFAULT_SECRETS=1 to
// override — greppable, and an explicit choice rather than an accident.

import {
  PERSONAS,
  PERSONA_ORDER,
  isPersonaId,
  type PersonaId,
} from "@/lib/persona";

export const SESSION_COOKIE = "moid_session";
/** Session lifetime (seconds). Default 12h plant shift. */
export const SESSION_TTL_SEC = 60 * 60 * 12;

/**
 * Built-in session signing key when MOID_AUTH_SECRET is unset.
 * Must be ≥16 chars. Change/override for production plants that need
 * independent session invalidation across environments.
 */
export const DEFAULT_AUTH_SECRET =
  "moid-built-in-session-hmac-v1-not-for-high-security-plants";

/** Fixed login ids — identical to PersonaId / topbar roles. */
export const PRESET_LOGIN_IDS: readonly PersonaId[] = PERSONA_ORDER;

/**
 * Default pilot passwords (override in env for real plants).
 * Documented in .env.example — change before any real deployment.
 */
export const DEFAULT_PRESET_PASSWORDS: Record<PersonaId, string> = {
  gm: "moid-gm",
  owner: "moid-owner",
  operator: "moid-operator",
};

export type AuthUser = {
  /** Same as role id: gm | owner | operator */
  username: string;
  password: string;
  role: PersonaId;
};

/** Public list for the login picker (no secrets). */
export type LoginOption = {
  id: PersonaId;
  username: string;
  label: string;
  title: string;
  initial: string;
  homeHref: string;
};

/** True when this process is a real deployment and has not opted out. */
function productionSecretsRequired(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.MOID_ALLOW_DEFAULT_SECRETS !== "1"
  );
}

/** Names of the env vars a production deployment must set. */
export function missingProductionSecrets(): string[] {
  const missing: string[] = [];
  if ((process.env.MOID_AUTH_SECRET ?? "").trim().length < 16) {
    missing.push("MOID_AUTH_SECRET");
  }
  const shared = (process.env.MOID_AUTH_PASSWORD ?? "").trim();
  for (const role of PRESET_LOGIN_IDS) {
    const own = (process.env[`MOID_AUTH_PASSWORD_${role.toUpperCase()}`] ?? "").trim();
    if (!own && !shared) missing.push(`MOID_AUTH_PASSWORD_${role.toUpperCase()}`);
  }
  return missing;
}

/**
 * Fail closed in production rather than fall back to the repo's public
 * constants. Called from the auth paths, never at module scope, so a build
 * that only imports this file still succeeds.
 */
export function assertProductionSecrets(): void {
  if (!productionSecretsRequired()) return;
  const missing = missingProductionSecrets();
  if (missing.length === 0) return;
  throw new Error(
    `Refusing to authenticate with built-in credentials. Set ${missing.join(", ")} ` +
      `(these defaults are public in src/lib/auth/config.ts, so any checkout could ` +
      `forge a GM session). Set MOID_ALLOW_DEFAULT_SECRETS=1 only for a throwaway demo.`,
  );
}

/** Signing secret: env override, else the built-in default (dev only). */
export function getAuthSecret(): string {
  assertProductionSecrets();
  const s = (process.env.MOID_AUTH_SECRET ?? "").trim();
  return s.length >= 16 ? s : DEFAULT_AUTH_SECRET;
}

/** Length-independent, constant-time string compare. `!==` on a password
 *  short-circuits at the first differing byte and leaks its position. */
function secretEquals(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  // Compare a fixed number of bytes so the loop count reveals no length.
  let diff = ab.length ^ bb.length;
  const n = Math.max(ab.length, bb.length, 1);
  for (let i = 0; i < n; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

/** Password for a preset role: env override, else default pilot password. */
export function passwordForRole(role: PersonaId): string {
  assertProductionSecrets();
  const envKeys: Record<PersonaId, string[]> = {
    gm: ["MOID_AUTH_PASSWORD_GM", "MOID_AUTH_PASSWORD"],
    owner: ["MOID_AUTH_PASSWORD_OWNER", "MOID_AUTH_PASSWORD"],
    operator: ["MOID_AUTH_PASSWORD_OPERATOR", "MOID_AUTH_PASSWORD"],
  };
  for (const key of envKeys[role]) {
    const v = (process.env[key] ?? "").trim();
    if (v) return v;
  }
  return DEFAULT_PRESET_PASSWORDS[role];
}

/** Always the three topbar roles when auth is configured. */
export function getAuthUsers(): AuthUser[] {
  return PRESET_LOGIN_IDS.map((role) => ({
    username: role,
    password: passwordForRole(role),
    role,
  }));
}

export function listLoginOptions(): LoginOption[] {
  return PRESET_LOGIN_IDS.map((id) => {
    const p = PERSONAS[id];
    return {
      id,
      username: id,
      label: p.label,
      title: p.title,
      initial: p.initial,
      homeHref: p.homeHref,
    };
  });
}

/** Sign-in is always required (preset GM / Owner / Operator). */
export function isAuthEnabled(): boolean {
  return true;
}

/**
 * Accept username or role id (gm / owner / operator) + password.
 * Username is case-insensitive for convenience.
 */
export function findUser(
  username: string,
  password: string,
): AuthUser | null {
  const u = username.trim().toLowerCase();
  // Allow full labels loosely? Stick to ids + common aliases.
  const aliases: Record<string, PersonaId> = {
    gm: "gm",
    "general manager": "gm",
    "general manager (gm)": "gm",
    owner: "owner",
    operator: "operator",
    "data entry operator": "operator",
    "data-entry": "operator",
  };
  const role: PersonaId | null = isPersonaId(u)
    ? u
    : aliases[u] ?? null;
  if (!role) return null;
  const user = getAuthUsers().find((x) => x.role === role);
  if (!user || !secretEquals(user.password, password)) return null;
  return user;
}

/** @deprecated kept for tests that built custom user lists — use presets. */
export function parseAuthUsers(raw: string | undefined | null): AuthUser[] {
  // Legacy MOID_AUTH_USERS: if set, still merge as extra passwords for roles
  // only when entries map to a known role (ignore free-form extra users).
  const s = (raw ?? "").trim();
  if (!s) return getAuthUsers();
  // Prefer preset model; legacy string ignored for login identity.
  return getAuthUsers();
}
