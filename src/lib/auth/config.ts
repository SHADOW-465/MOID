// Preset plant logins = the same three roles as the topbar persona switcher
// (GM, Owner, Operator). Operator picks a role on /login and enters that
// role's password.
//
// Auth is ON when MOID_AUTH_SECRET is set (≥16 chars). Without it the app
// stays open and the topbar role switcher works as before (demo / Vercel).

import {
  PERSONAS,
  PERSONA_ORDER,
  isPersonaId,
  type PersonaId,
} from "@/lib/persona";

export const SESSION_COOKIE = "moid_session";
/** Session lifetime (seconds). Default 12h plant shift. */
export const SESSION_TTL_SEC = 60 * 60 * 12;

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

export function getAuthSecret(): string | null {
  const s = (process.env.MOID_AUTH_SECRET ?? "").trim();
  return s.length >= 16 ? s : null;
}

/** Password for a preset role: env override, else default pilot password. */
export function passwordForRole(role: PersonaId): string {
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

/** True when MOID_AUTH_SECRET is set — presets are always available then. */
export function isAuthEnabled(): boolean {
  return !!getAuthSecret();
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
  if (!user || user.password !== password) return null;
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
