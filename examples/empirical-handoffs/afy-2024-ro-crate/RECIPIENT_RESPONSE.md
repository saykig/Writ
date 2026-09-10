# Recipient response contract

Return one JSON object. This is an example-local continuation contract, not a Writ core schema and
not a statistical certificate.

Required shape:

```json
{
  "schema": "example.afy2024.recipient-assessment.v1",
  "assessment_id": "a unique non-empty identifier",
  "predecessor": {
    "assessment_id": "afy-2024-retrospective-comparison.original",
    "sha256": "the exact SHA-256 of handoff/original-assessment.json"
  },
  "question": "the question from handoff/recipient-task.json",
  "intended_use": { "the five exact fields supplied in the task": "..." },
  "challenge": {
    "dependency_kind": "intended_use",
    "dependency_id": "requested_intended_use.<one actually changed field>",
    "summary": "what is challenged and why",
    "evidence_pointers": [
      {
        "file": "a relative attached JSON file",
        "json_pointer": "/a/valid/JSON/pointer"
      }
    ]
  },
  "numerical_receiving": {
    "status": "freshly_received",
    "evidence_file": "native-receiving.json",
    "scope": "what that receiver checked"
  },
  "empirical_support": {
    "status": "supported, inconclusive, not_established, or contested",
    "findings": ["claims grounded in the cited evidence pointers"]
  },
  "applicability": {
    "status": "reassessment_required, not_established, or inapplicable",
    "changed_dependencies": ["all changed intended-use fields, sorted"]
  },
  "disposition": {
    "status": "a supplied recipient judgment",
    "rationale": "why",
    "authority_to_act": false
  },
  "limits": ["at least one retained limit"]
}
```

The response must not copy an expected conclusion from a fixture: none is supplied. The recipient
must inspect the attached results. `evidence_pointers` are checked for existence at reimport, but
the reimporter does not turn the recipient's interpretation into empirical truth. Changed use may
not be labelled `same_declared_use`, the challenged dependency must name one actually changed
intended-use field, and the response cannot confer authority to act.
