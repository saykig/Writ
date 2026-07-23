#!/usr/bin/env python3
"""Generate examples/ai-governance-gap-matrix.covenant from Sara Kim's Gap Matrix
methodology in ~/personal/cepheus (fields.json + scoring-rubrics.json).

The port encodes each analyst assessment as a reviewed evidence claim
(`assessed_level`), and each rubric component as a weighted measure component
whose five ordinal anchors fire on that level. Pending components (no reviewed
level claim) make the component — and, by propagation, the axis index — pending.
"""
import json
import os
import textwrap

GM = os.path.expanduser("~/personal/cepheus/public/data/gap-matrix")
OUT = os.path.join(os.path.dirname(__file__), "..", "examples", "ai-governance-gap-matrix.covenant")

fields = json.load(open(os.path.join(GM, "fields.json")))
rubrics = {r["id"]: r for r in json.load(open(os.path.join(GM, "scoring-rubrics.json")))["rubrics"]}


def ident(s: str) -> str:
    return s.replace("-", "_")


def anchors_for(component_id: str) -> str:
    rub = rubrics[component_id]
    lines = []
    for level in range(5):
        desc = rub["anchors"][str(level)]
        wrapped = textwrap.fill(desc, width=88, initial_indent="      // ", subsequent_indent="      // ")
        lines.append(wrapped)
        # All claims in this snapshot are `assessed_level` claims, so (subject_ref,
        # object) identifies the component's level unambiguously. `predicate` is a
        # grammar keyword, so it is not used as a query field.
        lines.append(
            f'      anchor {level} when exists(claims where subject_ref == "{component_id}"'
            f" and object == {level});"
        )
    return "\n".join(lines)


def measure_block(measure_id: str, metric_key: str) -> str:
    comps = fields["metrics"][metric_key]["components"]
    parts = [f"  measure {measure_id} {{"]
    for c in comps:
        parts.append(f"    // {rubrics[c['id']]['label']}")
        parts.append(f"    component {ident(c['id'])} weight {c['weight']} {{")
        parts.append(anchors_for(c["id"]))
        parts.append("    }")
    parts.append("    aggregate weighted_ordinal_percent scale 4;")
    parts.append("  }")
    return "\n".join(parts)


body = f'''language covenant "0.1"
package science.ai_governance.gap_matrix version "1.0.0";

// The Gap Matrix (Sara Kim, cepheus "What We Owe to Each Other"), ported to
// Covenant. A frontier-AI governance field is scored on two weighted-ordinal
// axes — how concentrated the knowledge/control is, and how much public
// authority exists — from reviewed analyst assessments. The distance between
// them is the governance gap: who knows vs. who decides.
//
// Methodology of record: cepheus gap-matrix methodologyVersion {fields["assessment"]["methodologyVersion"]},
// holistic across {", ".join(fields["assessment"]["geographicScope"])}. Each analyst assessment is a
// reviewed `assessed_level` claim; a component with no reviewed level is pending,
// and any pending component makes its axis index pending (never a silent 0).

commitment FRONTIER_AI_GOVERNANCE {{
  title "{fields["label"]}";
  subjects {{ "{fields["id"]}" }};
  evaluation_window [2025-01-01, {fields["assessment"]["evidenceCutoff"]}];
  evidence_policy open_world;
  unknown_policy propagate;
  action_identity strict_separate by id;

{measure_block("knowledge_concentration", "knowledgeConcentration")}

{measure_block("public_authority", "publicAuthority")}

  // The governance gap: knowledge concentration minus public authority. Pending
  // on either side (a real state of this live assessment) makes the gap pending.
  let gap: Int = subtract(knowledge_concentration, public_authority);

  score {{
    result "not_applicable" priority 0 when public_authority__public id measurement;
    otherwise not_applicable "This field's outcome is a set of graded measures; see the receipt measures.";
  }}
}}
'''

with open(OUT, "w") as f:
    f.write(body)
print(f"wrote {os.path.relpath(OUT)} ({body.count(chr(10))} lines)")
