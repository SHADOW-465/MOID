// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { generateObject, generateText } from "ai";
import { tryModels } from "@/lib/ai";
import { InsightSlideAnswerSchema } from "@/lib/schemas";
import type { DashboardConfig, KPI, Chart } from "@/types/dashboard";
import { catalogForPrompt } from "@/lib/guide/app-catalog";

const SYSTEM_PROMPT =
  "You are MOID, the Manufacturing Operational Intelligence guide for this plant app. " +
  "You answer analytics questions AND help users use the product. " +
  "When verified figures are provided, every number you state MUST come from them — " +
  "never invent, estimate, or recompute. If a figure is missing, say so plainly. " +
  "For how-to questions, give exact click-by-click steps using real screen names " +
  "(Dashboard, Data Entry, Excel Data, By Stage, By Size, By Defect, SPC, Reports, " +
  "CAPA, Plant Schema, Settings). Prefer short scannable steps.";

const GUIDE_SYSTEM =
  "You are MOID, in-app product guide for a medical-device plant quality OS. " +
  "Direct the user to the correct screen and describe exact steps. " +
  "Never invent KPI numbers. If they ask for metrics without verified figures, " +
  "tell them which page to open (Dashboard / Reports / analysis screens) and how to set the date range.";

const fmtKpi = (k: KPI) =>
  `- ${k.label}: ${k.value}${k.unit ? " " + k.unit : ""}` +
  `${k.context ? `  [${k.context}]` : ""}${k.delta ? `  (${k.delta})` : ""}`;

function fmtChart(c: Chart): string {
  const labels = c.data?.labels ?? [];
  const series = c.data?.datasets?.[0]?.data ?? [];
  const pairs = labels.map((l, i) => `${l}=${series[i] ?? "?"}`).join(", ");
  return `- ${c.title} (${c.type}): ${pairs}`;
}

/**
 * Ground the chat in the SAME verified, structured data the dashboard shows
 * (KPIs, chart series, per-sheet sections) — not the raw parser input. This
 * keeps chat answers consistent with the dashboard and auditable.
 */
function buildChatContext(cfg: DashboardConfig): string {
  const parts: string[] = [];
  if (cfg.dashboardTitle) parts.push(`ANALYSIS: ${cfg.dashboardTitle}`);
  if (cfg.executiveSummary) parts.push(`SUMMARY: ${cfg.executiveSummary}`);

  parts.push("VERIFIED HEADLINE METRICS (combined across all sheets):");
  parts.push((cfg.kpis ?? []).map(fmtKpi).join("\n") || "(none)");

  if (cfg.charts?.length) {
    parts.push("VERIFIED CHART SERIES:");
    parts.push(cfg.charts.map(fmtChart).join("\n"));
  }

  if (cfg.sections?.length) {
    parts.push("VERIFIED PER-SHEET BREAKDOWN (one row per source sheet / month):");
    parts.push(
      cfg.sections
        .map(
          (s) =>
            `- ${s.label}: ` +
            s.kpis
              .map((k) => `${k.label}=${k.value}${k.unit ? " " + k.unit : ""}`)
              .join(", "),
        )
        .join("\n"),
    );
  }

  if (cfg.insights?.length) {
    parts.push("PRIOR OBSERVATIONS:\n" + cfg.insights.map((i) => `- ${i}`).join("\n"));
  }
  return parts.join("\n\n");
}

function buildPrompt(question: string, currentConfig: DashboardConfig): string {
  return [
    buildChatContext(currentConfig),
    "",
    `USER QUESTION: ${question}`,
    "",
    "Answer using ONLY the verified figures above (reference specific labels and " +
      "numbers). For comparisons or trends, build a chart from the per-sheet " +
      "breakdown or chart series. Generate the insight slide now.",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { question, currentConfig, mode } = body as {
      question?: string;
      currentConfig?: DashboardConfig;
      /** "guide" = product help without requiring KPI context */
      mode?: "analytics" | "guide" | "summary";
    };

    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const cfg = (currentConfig ?? {}) as DashboardConfig;
    const isGuide = mode === "guide" || !cfg.kpis?.length;

    // Product-guide path: no inventing numbers; catalog is the source of truth for screens.
    if (isGuide && mode === "guide") {
      try {
        const { text } = await tryModels((model) =>
          generateText({
            model,
            system: GUIDE_SYSTEM,
            prompt: [
              catalogForPrompt(),
              "",
              `USER QUESTION: ${question}`,
              "",
              "Answer with:",
              "1. One bold line stating the destination screen.",
              "2. Numbered steps (max 6) with exact UI labels.",
              "3. Optional tip line.",
              "No JSON. No invented metrics.",
            ].join("\n"),
            temperature: 0.2,
            maxRetries: 1,
          }),
        );
        return NextResponse.json({
          type: "text",
          text: text.trim() || "Open the left sidebar and pick the screen that matches your task — or ask “how do I enter today’s data?”.",
        });
      } catch (guideErr) {
        console.warn("[chat] guide mode failed:", guideErr);
        return NextResponse.json({
          type: "text",
          text:
            "I can guide you offline: try “how do I enter today’s data?”, “how do I import Excel?”, or “open defect analysis”.",
        });
      }
    }

    if (!cfg.kpis?.length) {
      return NextResponse.json(
        { error: "No analysis context available to answer against." },
        { status: 400 },
      );
    }

    const prompt = buildPrompt(question, cfg);
    const summaryHint =
      mode === "summary"
        ? "\n\nThe user wants a concise executive summary of this scoped period. Lead with the headline rates, then top stage and defect drivers from the verified figures."
        : "";

    try {
      const { object } = await tryModels((model) =>
        generateObject({
          model,
          schema: InsightSlideAnswerSchema,
          system: SYSTEM_PROMPT,
          prompt: prompt + summaryHint,
          temperature: 0.2,
          maxRetries: 1, // fail fast so the backend chain cascades quickly
        }),
      );

      return NextResponse.json({
        type: "slide",
        slide: {
          question,
          headline: object.headline,
          charts: object.charts,
          bullets: object.bullets,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (slideErr) {
      console.warn("[chat] slide generation failed, trying text fallback...", slideErr);
      try {
        const { text } = await tryModels((model) =>
          generateText({
            model,
            system: SYSTEM_PROMPT,
            prompt:
              prompt +
              summaryHint +
              "\n\nFormat your answer as clear, scannable Markdown so it reads at a glance. Use this structure:\n" +
              "1. A one-line **bold summary** answering the question directly.\n" +
              "2. A short bulleted list (`- `) of the supporting verified figures — wrap every number in **bold**.\n" +
              "3. (Optional) one '> ' blockquote line with a caveat if the data can't fully answer it.\n" +
              "Keep it under ~8 lines. Use only the verified figures above. No headings, no JSON, no code fences.",
            temperature: 0.2,
            maxRetries: 1,
          }),
        );
        return NextResponse.json({ type: "text", text: text.trim() || "I couldn't find that in the verified figures." });
      } catch (textErr) {
        console.error("[chat] text fallback failed:", textErr);
        // High-reliability rule-based fallback using verified cockpit KPIs
        const kpiText = (cfg.kpis ?? []).map(k => `- ${k.label}: ${k.value}${k.unit ? " " + k.unit : ""}`).join("\n");
        const fallbackText = `The AI service is currently rate-limited. Here are the verified cockpit metrics for your reference:\n\n${kpiText}`;
        return NextResponse.json({ type: "text", text: fallbackText });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[chat] fatal:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
