// src/shared/models/entities.ts
// Resolver ⇄ staging-verification exchange types (ADD §11).
// MappingProposal is ALSO the LLM generateObject target in resolver rung 5, so
// it follows the cross-provider rules from src/lib/schemas.ts: .nullable()
// everywhere (never .optional()), no literal unions, plain ints/numbers.

import { z } from "zod";
import { ModEntityKind, ResolvedBy } from "./ontology";

export const ProposalAlternative = z.object({
  canonical: z.string(),
  confidence: z.number().min(0).max(1),
  resolvedBy: ResolvedBy,
});

/** One proposed mapping for one source column/sheet. The resolver PROPOSES;
 *  only user verification makes it real. */
export const MappingProposal = z.object({
  entityId: z.string().min(1),
  kind: ModEntityKind,
  original: z.object({
    sheet: z.string(),
    tableId: z.string().nullable().optional(),
    colLetter: z.string().nullable(),
    header: z.string(),
  }),
  canonical: z.string().nullable(),
  subcategory: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  resolvedBy: ResolvedBy,
  reason: z.string(),
  alternatives: z.array(ProposalAlternative),
  /**
   * How well this region's reading satisfies the sheet's OWN arithmetic —
   * attached to the region's stage proposal. This is what a steward should
   * actually verify against: not whether a header "looks like" Checked, but
   * whether reading it that way makes the sheet add up. Optional because only
   * region-level proposals carry it, and only when something was checkable.
   */
  evidence: z
    .object({
      agreement: z.number(),
      applicable: z.number(),
      failingRows: z.array(z.number()),
    })
    .nullable()
    .optional(),
});

/** What the LLM rung returns for a whole profile (never applied silently). */
export const MappingProposalSet = z.object({
  proposals: z.array(MappingProposal),
});

/** One user decision on one proposal in the staging verification panel. */
export const VerificationDecision = z.object({
  entityId: z.string().min(1),
  /** "accept" keeps the proposal; "override" rewrites canonical/kind. */
  action: z.enum(["accept", "override"]),
  canonical: z.string().nullable(),                // required when action=override
  kind: ModEntityKind.nullable(),
  comment: z.string().nullable(),
});

export type MappingProposalT = z.infer<typeof MappingProposal>;
export type VerificationDecisionT = z.infer<typeof VerificationDecision>;
