// Store round-trip. jest.setup forces MOID_STORE=memory, so this exercises the
// memory adapter — the Supabase one mirrors it and is covered by the shape of
// PolicyVersion, not by a live connection.

import { getPolicyStore, __resetPolicyStoreForTests } from "../policy-store";
import { DEFAULT_POLICY } from "../policy";

beforeEach(() => __resetPolicyStoreForTests());

test("nothing saved yet = shipped defaults at version 0", async () => {
  const cur = await getPolicyStore().current("acme");
  expect(cur.version).toBe(0);
  expect(cur.policy).toEqual(DEFAULT_POLICY);
  expect(await getPolicyStore().history("acme")).toEqual([]);
});

test("saves append versions and the latest one wins", async () => {
  const store = getPolicyStore();
  await store.save("acme", { ...DEFAULT_POLICY, targetRejectionPct: 8 }, { changedBy: "GM", note: "FY26 plan" });
  const v2 = await store.save(
    "acme",
    { ...DEFAULT_POLICY, reworkCountsAs: "checked" },
    { changedBy: "GM", note: "match the audit" },
  );

  expect(v2.version).toBe(2);
  const cur = await store.current("acme");
  expect(cur.version).toBe(2);
  expect(cur.policy.reworkCountsAs).toBe("checked");
  // v2 was built from DEFAULT_POLICY, so the v1 target is not carried forward.
  expect(cur.policy.targetRejectionPct).toBe(DEFAULT_POLICY.targetRejectionPct);
});

test("history is newest-first and keeps the note for the audit trail", async () => {
  const store = getPolicyStore();
  await store.save("acme", DEFAULT_POLICY, { changedBy: "GM", note: "first" });
  await store.save("acme", DEFAULT_POLICY, { changedBy: "QM", note: "second" });

  const h = await store.history("acme");
  expect(h.map((r) => r.version)).toEqual([2, 1]);
  expect(h[0].note).toBe("second");
  expect(h[0].changedBy).toBe("QM");
});

test("reverting is just saving the old values again", async () => {
  const store = getPolicyStore();
  const v1 = await store.save("acme", DEFAULT_POLICY, { changedBy: "GM", note: "baseline" });
  await store.save("acme", { ...DEFAULT_POLICY, reworkCountsAs: "checked" }, { changedBy: "GM", note: "try counting rework" });
  const v3 = await store.save("acme", v1.policy, { changedBy: "GM", note: "revert to v1" });

  expect(v3.version).toBe(3);
  expect((await store.current("acme")).policy).toEqual(DEFAULT_POLICY);
  // History is never rewritten — the experiment stays visible.
  expect((await store.history("acme")).map((r) => r.note)).toEqual(["revert to v1", "try counting rework", "baseline"]);
});

test("policy is per company", async () => {
  const store = getPolicyStore();
  await store.save("acme", { ...DEFAULT_POLICY, unitCostInr: 99 }, { changedBy: "GM", note: "acme only" });
  expect((await store.current("acme")).policy.unitCostInr).toBe(99);
  expect((await store.current("other")).policy.unitCostInr).toBe(DEFAULT_POLICY.unitCostInr);
});

test("plant baseline is independent of live policy until restored", async () => {
  const store = getPolicyStore();
  expect(await store.baseline("acme")).toBeNull();

  const base = await store.setBaseline(
    "acme",
    { ...DEFAULT_POLICY, targetRejectionPct: 7 },
    { changedBy: "GM", note: "Set as plant default" },
  );
  expect(base.policy.targetRejectionPct).toBe(7);
  expect((await store.baseline("acme"))?.policy.targetRejectionPct).toBe(7);

  // Live policy still shipped defaults until someone saves live.
  expect((await store.current("acme")).policy.targetRejectionPct).toBe(
    DEFAULT_POLICY.targetRejectionPct,
  );

  await store.save(
    "acme",
    { ...DEFAULT_POLICY, targetRejectionPct: 12 },
    { changedBy: "GM", note: "temporary raise" },
  );
  expect((await store.current("acme")).policy.targetRejectionPct).toBe(12);
  // Baseline untouched by a normal save.
  expect((await store.baseline("acme"))?.policy.targetRejectionPct).toBe(7);
});

test("setBaseline overwrites the restore point without appending history", async () => {
  const store = getPolicyStore();
  await store.save("acme", DEFAULT_POLICY, { changedBy: "GM", note: "live v1" });
  await store.setBaseline(
    "acme",
    { ...DEFAULT_POLICY, unitCostInr: 40 },
    { changedBy: "GM", note: "default A" },
  );
  await store.setBaseline(
    "acme",
    { ...DEFAULT_POLICY, unitCostInr: 55 },
    { changedBy: "GM", note: "default B" },
  );

  expect((await store.baseline("acme"))?.policy.unitCostInr).toBe(55);
  // History still only the live save — baseline is not a history entry.
  expect((await store.history("acme")).map((r) => r.note)).toEqual(["live v1"]);
});
