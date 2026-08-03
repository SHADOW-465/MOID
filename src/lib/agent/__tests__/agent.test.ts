import { classifyTaskKind, isConfirmMessage, isCancelMessage } from "../classify";
import { extractEntrySlots } from "../extract-entry-slots";
import { inferAssemblyProcessFromDefects, applyStageInference } from "../infer-stage";
import {
  missingEntrySlots,
  validateEntryBalance,
  defectSum,
} from "../missing-slots";
import { runTurn } from "../run-turn";
import { buildEntryDraft } from "../build-draft";
import type { AgentCtx } from "../types";

const TODAY = "2026-08-03";
const DATA_MAX = "2025-08-15";

const ctx: AgentCtx = {
  dataMaxIso: DATA_MAX,
  todayIso: TODAY,
  persona: "gm",
  canWrite: true,
};

const EXAMPLE =
  "how do i enter data i want only assembly to enter, can you do it for me checked value is 400, accepted 390 rejected reasons coag 5 sd 3 bl 2";

describe("classifyTaskKind", () => {
  it("classifies the assembly do-it example as enter_data", () => {
    expect(classifyTaskKind(EXAMPLE)).toBe("enter_data");
  });

  it("classifies report summarize as report", () => {
    expect(classifyTaskKind("summarize july first week report")).toBe("report");
  });

  it("classifies pure how-to without numbers as howto", () => {
    expect(classifyTaskKind("how do I enter data?")).toBe("howto");
  });

  it("detects confirm / cancel", () => {
    expect(isConfirmMessage("yes")).toBe(true);
    expect(isConfirmMessage("confirm")).toBe(true);
    expect(isCancelMessage("cancel")).toBe(true);
  });
});

describe("extractEntrySlots", () => {
  it("parses checked, accepted, and coag/sd/bl defects", () => {
    const s = extractEntrySlots(EXAMPLE, TODAY);
    expect(s.macro).toBe("assembly");
    expect(s.checked).toBe(400);
    expect(s.acceptedGood).toBe(390);
    expect(s.defects).toMatchObject({ COAG: 5, SD: 3, BL: 2 });
  });

  it("parses follow-up today, batch, size", () => {
    const s = extractEntrySlots("today, batch 26A01-16, 16Fr", TODAY);
    expect(s.date).toBe(TODAY);
    expect(s.batchId).toBe("26A01-16");
    expect(s.size).toBe("16Fr");
  });
});

describe("inferAssemblyProcessFromDefects", () => {
  it("maps COAG/SD/BL to visual", () => {
    const r = inferAssemblyProcessFromDefects(["COAG", "SD", "BL"]);
    expect(r?.stageId).toBe("visual");
    expect(r?.micro).toBe("p15-visual");
  });
});

describe("missing + balance", () => {
  it("lists date batch size when quantities present", () => {
    const s = extractEntrySlots(EXAMPLE, TODAY);
    const inferred = applyStageInference(s).slots;
    const missing = missingEntrySlots(inferred);
    expect(missing).toEqual(expect.arrayContaining(["date", "batchId", "size"]));
    expect(missing).not.toContain("stage");
  });

  it("balances 400 / 390 / defects 10", () => {
    const s = {
      macro: "assembly" as const,
      checked: 400,
      acceptedGood: 390,
      defects: { COAG: 5, SD: 3, BL: 2 },
      rejected: 10,
    };
    expect(defectSum(s.defects)).toBe(10);
    expect(validateEntryBalance(s)).toBeNull();
  });

  it("flags defect sum vs rejected mismatch", () => {
    const err = validateEntryBalance({
      macro: "assembly",
      checked: 400,
      acceptedGood: 392,
      rejected: 8,
      defects: { COAG: 5, SD: 3, BL: 2 },
    });
    expect(err).toMatch(/Defects sum to 10/);
  });
});

describe("runTurn multi-turn entry", () => {
  it("asks for missing fields on first message, then confirms after fill", () => {
    const t1 = runTurn(null, EXAMPLE, ctx);
    expect(t1.session?.kind).toBe("enter_data");
    expect(t1.session?.status).toBe("collecting");
    expect(t1.session?.entrySlots.stageId).toBe("visual");
    expect(t1.reply.text).toMatch(/I still need/i);
    expect(t1.reply.autoTools.some((x) => x.type === "ingest")).toBe(false);

    const t2 = runTurn(t1.session, "today batch 26A01-16 16Fr", ctx);
    expect(t2.session?.status).toBe("confirming");
    expect(t2.reply.draft?.kind).toBe("enter_data");
    expect(t2.reply.actions.some((a) => a.kind === "confirm_ingest")).toBe(true);

    const t3 = runTurn(t2.session, "confirm", ctx);
    expect(t3.reply.autoTools.some((x) => x.type === "ingest")).toBe(true);
  });

  it("pure howto does not open ingest path", () => {
    const t = runTurn(null, "how do I enter data?", ctx);
    expect(t.session).toBeNull();
    expect(t.reply.steps?.length || t.reply.text.length).toBeGreaterThan(0);
    expect(t.reply.autoTools.some((x) => x.type === "ingest")).toBe(false);
  });

  it("report task scopes july first week and opens reports", () => {
    const t = runTurn(null, "summarize july first week report", ctx);
    expect(t.session?.kind).toBe("report");
    expect(t.reply.autoTools.some((x) => x.type === "open_reports")).toBe(true);
    expect(t.reply.autoTools.some((x) => x.type === "summarize")).toBe(true);
    const open = t.reply.autoTools.find((x) => x.type === "open_reports");
    if (open && open.type === "open_reports") {
      expect(open.state.from).toBe("2025-07-01");
      expect(open.state.to).toBe("2025-07-07");
    }
  });
});

describe("buildEntryDraft", () => {
  it("builds a draft with plant shape fields", () => {
    const draft = buildEntryDraft({
      macro: "assembly",
      micro: "p15-visual",
      stageId: "visual",
      processName: "Visual (P17)",
      checked: 400,
      acceptedGood: 390,
      rejected: 10,
      defects: { COAG: 5, SD: 3, BL: 2 },
      date: TODAY,
      batchId: "26A01-16",
      size: "16Fr",
    });
    expect(draft).not.toBeNull();
    expect(draft!.summaryRows.find((r) => r.label === "Checked")?.value).toBe("400");
  });
});

describe("workflows + suggestions", () => {
  it("classifies Monday GM review as workflow", () => {
    expect(classifyTaskKind("Monday GM review")).toBe("workflow");
  });

  it("starts Monday pack and advances with next", () => {
    const t1 = runTurn(null, "Monday GM review", ctx);
    expect(t1.session?.kind).toBe("workflow");
    expect(t1.reply.autoTools.some((x) => x.type === "summarize" || x.type === "navigate")).toBe(true);
    expect(t1.reply.actions.some((a) => a.kind === "workflow_next")).toBe(true);

    const t2 = runTurn(t1.session, "next", ctx);
    expect(t2.session?.workflow?.stepIndex).toBe(1);
    expect(t2.reply.text).toMatch(/step 2/i);
  });

  it("exposes prefill action on entry confirm", () => {
    const t1 = runTurn(null, EXAMPLE, ctx);
    const t2 = runTurn(t1.session, "today batch 26A01-16 16Fr", ctx);
    expect(t2.reply.actions.some((a) => a.kind === "prefill_entry")).toBe(true);
  });

  it("report reply includes copy share link", () => {
    const t = runTurn(null, "summarize july first week report", ctx);
    expect(t.reply.actions.some((a) => a.kind === "copy_link")).toBe(true);
  });
});
