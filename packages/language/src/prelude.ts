/**
 * The Writ standard prelude.
 *
 * A methodology may reference well-known entities that are not declared in its
 * own source but are provided by the standard library it implicitly imports
 * (`writ.std.g7`). The 2025 G7 examples all write `subjects G7Members;`
 * without declaring the set, and the golden IR for the literal example carries
 * `issue_areas: [artificial_intelligence, digital_economy]` for the AI-SME
 * commitment even though its source lists no issue areas. Both are supplied here
 * so lowering stays deterministic and source-derivable.
 *
 * RECONCILIATION NOTE: `issue_areas` has no in-source signal in any example — it
 * appears only in the golden IR and in `03_LANGUAGE_SPEC.md` §10. Rather than
 * weaken the golden, the commitment→issue-area mapping is treated as prelude
 * metadata (the way `G7Members` is a prelude set). See the deliverables report.
 */

/** Named institution sets provided by the standard prelude, in canonical order. */
export const PRELUDE_SETS: Readonly<Record<string, readonly string[]>> = {
  G7Members: [
    "Canada",
    "France",
    "Germany",
    "Italy",
    "Japan",
    "UnitedKingdom",
    "UnitedStates",
    "EuropeanUnion",
  ],
};

/**
 * Issue areas attached to well-known G7 commitments by the standard prelude.
 * Keyed by commitment id. A source-level `issue_areas { … }` declaration, when
 * present, always overrides this default.
 */
export const PRELUDE_ISSUE_AREAS: Readonly<Record<string, readonly string[]>> = {
  AI_SME_ADOPTION: ["artificial_intelligence", "digital_economy"],
};
