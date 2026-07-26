// src/lib/schemas.ts
// Zod schemas for AI structured output. generateObject validates against these
// — there is no JSON-scraping or manual coercion anywhere.
//
// ── Cross-provider compatibility rules ──────────────────────────────────────
// Different providers enforce different JSON-schema dialects:
//   • Groq strict mode    — every property must appear in `required`. No
//                           omittable keys. Optional fields must be nullable.
//   • OpenAI-compatible   — same as Groq strict mode; MiniCPM served through
//                           vLLM/llama.cpp follows the same dialect.
// We therefore use:
//   • `.nullable()` for "optional" fields (always present, possibly null),
//     NOT `.optional()` (which marks the key as omittable).
//   • Plain `z.number().int()` for bounded integers, NOT literal unions.

import { z } from "zod";


// ── InsightSlide (chat) ──────────────────────────────────────────────────────

const InsightChartSchema = z.object({
  title: z.string(),
  type: z.enum(["bar", "line", "doughnut"]),
  data: z.object({
    labels: z.array(z.string()),
    datasets: z
      .array(
        z.object({
          label: z.string(),
          data: z.array(z.number()),
        }),
      )
      .min(1),
  }),
});

export const InsightSlideAnswerSchema = z.object({
  headline: z
    .string()
    .describe("One sentence finding that MUST contain a specific number from the data"),
  charts: z
    .array(InsightChartSchema)
    .max(2)
    .describe("0 charts for text-only, 1 for simple, 2 for comparative questions"),
  bullets: z
    .array(z.string())
    .max(5)
    .describe("2-5 supporting points, each referencing a specific data point"),
});

export type InsightSlideAnswer = z.infer<typeof InsightSlideAnswerSchema>;
