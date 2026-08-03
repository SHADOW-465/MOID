// One route table. Deleting /chat meant editing four hardcoded lists of the
// same screens; missing one left a dead link that nothing type-checked.
// These assertions are what stops a fifth copy appearing.

import { NAV_ROUTES, ROUTED_NAV_KEYS, navHref, type NavKey } from "../nav-keys";
import { APP_FEATURES } from "../guide/app-catalog";
import { hrefForNav } from "../analytics/intent";

test("every key has a label, and only Ask MOID is route-less", () => {
  const routeless = (Object.keys(NAV_ROUTES) as NavKey[]).filter(
    (k) => NAV_ROUTES[k].href === null,
  );
  expect(routeless).toEqual(["ask"]);
  for (const k of Object.keys(NAV_ROUTES) as NavKey[]) {
    expect(NAV_ROUTES[k].label.trim()).not.toBe("");
  }
});

test("routes are absolute, unique, and exclude the panel", () => {
  const hrefs = ROUTED_NAV_KEYS.map((k) => NAV_ROUTES[k].href as string);
  expect(hrefs).toEqual(hrefs.filter((h) => h.startsWith("/")));
  expect(new Set(hrefs).size).toBe(hrefs.length);
  expect(ROUTED_NAV_KEYS).not.toContain("ask");
});

test("the deleted /chat route is gone from every derived surface", () => {
  const all = Object.values(NAV_ROUTES).map((r) => r.href ?? "");
  expect(all).not.toContain("/chat");
  expect(APP_FEATURES.map((f) => f.href)).not.toContain("/chat");
});

test("the guide catalog derives its label and href — no second copy", () => {
  for (const f of APP_FEATURES) {
    expect(f.label).toBe(NAV_ROUTES[f.navKey].label);
    expect(f.href).toBe(NAV_ROUTES[f.navKey].href ?? "");
  }
});

test("hrefForNav agrees with the table, and never returns null", () => {
  for (const k of Object.keys(NAV_ROUTES) as NavKey[]) {
    expect(hrefForNav(k)).toBe(navHref(k));
    expect(hrefForNav(k)).toMatch(/^\//);
  }
  // Panel-only keys fall back to the dashboard rather than a dead link.
  expect(navHref("ask")).toBe("/");
});
