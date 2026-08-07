"use client";

import { useEffect, useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import {
  PERSONAS,
  PERSONA_ORDER,
  type PersonaId,
} from "@/lib/persona";
import { usePersona } from "@/components/app/PersonaContext";
import "./login.css";

type LoginOption = {
  id: PersonaId;
  username: string;
  label: string;
  title: string;
  initial: string;
  homeHref: string;
};

function shortRoleLabel(id: PersonaId): string {
  if (id === "gm") return "GM";
  if (id === "owner") return "Owner";
  return "Operator";
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const nextParam = search.get("next");
  const { refreshAuth } = usePersona();

  const [logins, setLogins] = useState<LoginOption[]>(() =>
    PERSONA_ORDER.map((id) => {
      const p = PERSONAS[id];
      return {
        id,
        username: id,
        label: p.label,
        title: p.title,
        initial: p.initial,
        homeHref: p.homeHref,
      };
    }),
  );
  const [selected, setSelected] = useState<PersonaId>("gm");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [authOff, setAuthOff] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/logins", { credentials: "same-origin" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data.authEnabled === false) {
          setAuthOff(true);
          return;
        }
        if (Array.isArray(data.logins) && data.logins.length > 0) {
          setLogins(data.logins);
        }
      } catch {
        /* keep PERSONA_ORDER fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selected, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Sign-in failed.");
        return;
      }
      const home = data.user?.homeHref as string | undefined;
      const dest =
        nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
          ? nextParam
          : home && home.startsWith("/")
            ? home
            : "/";
      // Pull session into PersonaContext so Events/Registry re-fetch without a full reload.
      await refreshAuth();
      router.replace(dest);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (authOff) {
    return (
      <div className="login-page login-page--open">
        <div className="login-panel">
          <div className="login-open">
            <div className="login-mark">
              <span className="login-mark-glyph" aria-hidden>
                M
              </span>
              <span>
                <span className="login-mark-name">{BRAND_NAME}</span>
                <span className="login-mark-tag">{BRAND_TAGLINE}</span>
              </span>
            </div>
            <h1 className="login-panel-title">Sign-in is off on this deploy</h1>
            <p className="login-panel-sub">
              No auth secret is configured, so the app is open. Use the topbar role
              switcher (GM / Owner / Operator) once you are inside.
            </p>
            <div className="login-open-actions">
              <button
                type="button"
                className="login-submit"
                style={{ width: "auto", paddingInline: 20 }}
                onClick={() => router.replace("/")}
              >
                Continue to app
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedDef = logins.find((l) => l.id === selected) ?? logins[0];

  return (
    <div className="login-page">
      <aside className="login-rail" aria-label="About this product">
        <div className="login-rail-brand">
          <div className="login-mark">
            <span className="login-mark-glyph" aria-hidden>
              M
            </span>
            <span>
              <span className="login-mark-name">{BRAND_NAME}</span>
              <span className="login-mark-tag">{BRAND_TAGLINE}</span>
            </span>
          </div>
          <h1 className="login-rail-title">Plant quality, on the ledger.</h1>
          <p className="login-rail-lede">
            Sign in with your plant role. Numbers stay deterministic; the model never
            invents a KPI.
          </p>
          <ul className="login-rail-points">
            <li>Same three roles as the topbar persona switcher</li>
            <li>Nav and write rights follow the role you pick</li>
            <li>Works on plant LAN and on hosted pilots</li>
          </ul>
        </div>
        <p className="login-rail-foot">
          <strong>Session:</strong> about 12 hours. Sign out from the account menu when
          you are done on a shared terminal.
        </p>
      </aside>

      <main className="login-panel">
        <form className="login-panel-inner" onSubmit={onSubmit} noValidate>
          <header className="login-panel-head">
            <h2 className="login-panel-title">Sign in</h2>
            <p className="login-panel-sub">
              Choose a role, then enter its password.
            </p>
          </header>

          <div
            className="login-roles"
            role="listbox"
            aria-label="Role"
            aria-orientation="horizontal"
          >
            {logins.map((login) => {
              const on = login.id === selected;
              return (
                <button
                  key={login.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className="login-role"
                  onClick={() => {
                    setSelected(login.id);
                    setPassword("");
                    setError(null);
                  }}
                >
                  <span className="login-role-initial" aria-hidden>
                    {login.initial}
                  </span>
                  <span className="login-role-label">{shortRoleLabel(login.id)}</span>
                  <span className="login-role-hint">{login.title}</span>
                </button>
              );
            })}
          </div>

          <div className="login-field">
            <label className="login-field-label" htmlFor="login-password">
              Password{" "}
              <em>· {selectedDef?.label ?? shortRoleLabel(selected)}</em>
            </label>
            <input
              id="login-password"
              className="login-input"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
              disabled={busy}
            />
            <div className="login-field-help" aria-live="polite">
              {error ? null : "Password is set per role on this deployment."}
            </div>
          </div>

          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="login-submit"
            disabled={busy || !password}
          >
            {busy
              ? "Signing in…"
              : `Sign in as ${shortRoleLabel(selected)}`}
          </button>

          <p className="login-meta">
            After sign-in, the topbar shows this role. Switch by signing out and
            choosing another login.
          </p>
        </form>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="login-page login-page--open">
          <div className="login-panel">
            <div className="login-panel-inner">
              <p className="login-panel-sub">Loading…</p>
            </div>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
