// Persistence for calculation policy. Mirrors catalog-store: Supabase when
// configured, memory otherwise, and a missing table degrades to defaults
// instead of crashing the app (fresh deploy / not-yet-migrated prod).
//
// ponytail: append-only rows, latest version wins. No draft/active/retire —
// reverting is saving the old values again, which is one code path instead of
// three. Add a status column if someone needs to stage a change before it
// takes effect.

import { shouldUseSupabase } from "@/lib/store";
import { createServerClient } from "@/lib/supabase";
import {
  DEFAULT_POLICY,
  parsePolicy,
  type CalculationPolicyT,
  type PolicyVersion,
} from "./policy";

export const DEFAULT_COMPANY = "default";

export interface PolicyStore {
  current(companyId: string): Promise<PolicyVersion>;
  history(companyId: string): Promise<PolicyVersion[]>;
  save(
    companyId: string,
    policy: CalculationPolicyT,
    meta: { changedBy: string; note: string },
  ): Promise<PolicyVersion>;
}

/** Version 0 = nothing saved yet, i.e. the shipped defaults. */
function seedVersion(): PolicyVersion {
  return {
    version: 0,
    policy: DEFAULT_POLICY,
    changedBy: "system",
    changedAt: "",
    note: "Shipped defaults — matches how the app has always calculated.",
  };
}

class MemoryPolicyStore implements PolicyStore {
  private byCompany = new Map<string, PolicyVersion[]>();

  async current(companyId: string) {
    const rows = this.byCompany.get(companyId) ?? [];
    return rows.length ? rows[rows.length - 1] : seedVersion();
  }
  async history(companyId: string) {
    return [...(this.byCompany.get(companyId) ?? [])].reverse();
  }
  async save(companyId: string, policy: CalculationPolicyT, meta: { changedBy: string; note: string }) {
    const rows = this.byCompany.get(companyId) ?? [];
    const row: PolicyVersion = {
      version: (rows[rows.length - 1]?.version ?? 0) + 1,
      policy,
      changedBy: meta.changedBy,
      changedAt: new Date().toISOString(),
      note: meta.note,
    };
    this.byCompany.set(companyId, [...rows, row]);
    return row;
  }
}

type PolicyDbRow = {
  company_id: string;
  version: number;
  policy: unknown;
  changed_by: string;
  changed_at: string;
  note: string | null;
};

function fromDb(r: PolicyDbRow): PolicyVersion {
  return {
    version: r.version,
    policy: parsePolicy(r.policy),
    changedBy: r.changed_by,
    changedAt: r.changed_at,
    note: r.note ?? "",
  };
}

/** Reads degrade to defaults when the table is missing, but a WRITE must not
 *  fail silently or with a bare 500 — the GM needs to know why Save did
 *  nothing. Routes map this to a 503 with the message intact. */
export class PolicyTableMissingError extends Error {
  constructor() {
    super(
      "Calculation policy table not found. Apply supabase/migrations/20260804_calculation_policy.sql, " +
        "then reload. Until then the app runs on its shipped defaults.",
    );
    this.name = "PolicyTableMissingError";
  }
}

/** Table missing (not migrated yet) must not take the app down — same rule as
 *  catalog-store.get(). Any other error is real and rethrown. */
function isMissingTable(error: { code?: string; message?: string }): boolean {
  const code = error.code;
  const msg = error.message ?? "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (/calculation_policy/i.test(msg) && /does not exist|not find|schema cache/i.test(msg))
  );
}

class SupabasePolicyStore implements PolicyStore {
  private db() {
    return createServerClient();
  }

  async current(companyId: string) {
    const { data, error } = await this.db()
      .from("calculation_policy")
      .select("*")
      .eq("company_id", companyId)
      .order("version", { ascending: false })
      .limit(1);
    if (error) {
      if (isMissingTable(error)) return seedVersion();
      throw error;
    }
    return data?.length ? fromDb(data[0] as PolicyDbRow) : seedVersion();
  }

  async history(companyId: string) {
    const { data, error } = await this.db()
      .from("calculation_policy")
      .select("*")
      .eq("company_id", companyId)
      .order("version", { ascending: false });
    if (error) {
      if (isMissingTable(error)) return [];
      throw error;
    }
    return (data ?? []).map((r) => fromDb(r as PolicyDbRow));
  }

  async save(companyId: string, policy: CalculationPolicyT, meta: { changedBy: string; note: string }) {
    const cur = await this.current(companyId);
    const row = {
      company_id: companyId,
      version: cur.version + 1,
      policy,
      changed_by: meta.changedBy,
      changed_at: new Date().toISOString(),
      note: meta.note,
    };
    const { data, error } = await this.db()
      .from("calculation_policy")
      .insert(row)
      .select("*")
      .single();
    if (error) {
      if (isMissingTable(error)) throw new PolicyTableMissingError();
      throw error;
    }
    return fromDb(data as PolicyDbRow);
  }
}

const g = globalThis as unknown as { __moidPolicyStore?: PolicyStore };

export function getPolicyStore(): PolicyStore {
  if (!g.__moidPolicyStore) {
    g.__moidPolicyStore = shouldUseSupabase() ? new SupabasePolicyStore() : new MemoryPolicyStore();
  }
  return g.__moidPolicyStore;
}

/** Test helper — wipe singleton between suites. */
export function __resetPolicyStoreForTests() {
  g.__moidPolicyStore = undefined;
}
