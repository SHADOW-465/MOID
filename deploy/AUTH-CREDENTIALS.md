# MOID preset login credentials

These are the **fixed logins** on `/login` — the same three roles as the topbar
persona switcher. Enable sign-in by setting `MOID_AUTH_SECRET` (see below).

> **Change these before any real plant or production deploy.**  
> Defaults are for local / pilot only.

## Accounts

| Role (select on login page) | Username (fixed) | Default password   |
|-----------------------------|------------------|--------------------|
| General Manager (GM)        | `gm`             | `moid-gm`          |
| Owner                       | `owner`          | `moid-owner`       |
| Data Entry Operator         | `operator`       | `moid-operator`    |

## Enable auth (copy into `.env.local` or `deploy/.env` or Vercel)

```bash
# Required — turns on /login (≥16 characters)
MOID_AUTH_SECRET=change-me-to-a-long-random-string

# Optional — override defaults (recommended for plant)
MOID_AUTH_PASSWORD_GM=moid-gm
MOID_AUTH_PASSWORD_OWNER=moid-owner
MOID_AUTH_PASSWORD_OPERATOR=moid-operator

# Or one shared password for all three roles:
# MOID_AUTH_PASSWORD=your-shared-password
```

Generate a secret:

```bash
openssl rand -hex 32
```

## How to sign in

1. Open `/login` (or any page when auth is on — you are redirected).
2. Select **GM**, **Owner**, or **Operator**.
3. Enter that role’s password.
4. Sign out from the topbar account menu when finished.

## Without auth

If `MOID_AUTH_SECRET` is **not** set, the app stays open and the topbar role
switcher works without passwords (demo mode).

## Local override (optional)

Copy this file to `deploy/AUTH-CREDENTIALS.local.md` for plant-specific
passwords. That path is gitignored — do not commit real production secrets.
