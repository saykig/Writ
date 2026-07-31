# EU and US AI Governance Pilot for Writ

This is the right pilot to run before you hand anything to Codex. The narrow question should be:

> **Does the jurisdiction currently impose a binding model-evaluation requirement on providers of advanced or general-purpose AI models?**

For a first pass, the best comparison is **European Union versus United States federal policy**. That keeps the corpus small, gives you a real contrast between binding and voluntary governance, and fits the Writ logic you already set out: qualitative judgments first, source-linked evidence second, and scores only if they later become useful. fileciteturn0file0

The European Union already has binding obligations for providers of general-purpose AI models, with extra duties for models with systemic risk under the AI Act. Those obligations entered into application on 2 August 2025, while the Commission has publicly said it would work collaboratively during the first year and enforce full compliance for GPAI obligations from 2 August 2026; providers of GPAI models already on the market before 2 August 2025 have until 2 August 2027 to comply. By contrast, the U.S. federal materials most directly relevant to model evaluation are NIST’s AI RMF, the Generative AI Profile, CAISI evaluation work, and OMB memoranda for federal agency use and procurement. Those are important, but they are either voluntary, scoped to government acquisition and use, or framed as future federal action rather than a current cross-sector provider obligation. citeturn5view2turn0search4turn26search1turn28view0turn23view0turn23view1turn24view0turn22view2turn21view3turn29search6turn29search3

That means the likely **pilot outcome**, if you adopt a legal-strict interpretation and federal-only U.S. scope, is:

- **EU:** binding_applicable for systemic-risk GPAI model evaluation.
- **US federal:** no general binding provider-evaluation rule identified in the selected corpus; instead, voluntary evaluation standards and binding government-use/procurement requirements. citeturn5view1turn27view0turn23view0turn23view1turn24view0turn22view2turn21view3

## What to model now

Do **not** start by ingesting “all AI governance.” Start with one judgment that can be reused across jurisdictions:

> **binding_applicable**
> **binding_not_yet_applicable**
> **voluntary_only**
> **government_only_binding**
> **proposed_only**
> **unknown**
> **contested**

The point of the pilot is not to prove that Writ can collect lots of policy documents. It is to prove that the same qualitative reasoning language can evaluate two different governance systems without writing new evaluator logic for each one. That is exactly the failure mode you were worried about when you said Writ should not become custom code for every new methodology. fileciteturn0file0

For this reason, the corpus should be split into two layers.

The **discovery layer** should use the OECD AI Policy Navigator to find candidate instruments and keep a clean inventory of initiative names, dates, and jurisdictions. OECD describes the Navigator as a living repository from more than 80 jurisdictions, updated by official contact points and OECD analysts. That makes it useful for finding what to inspect, but not sufficient as the final authority for your judgment. Official EU and U.S. primary sources should still decide the actual claim records. citeturn11search0turn11search3turn11search4

The **authority layer** should use official sources only: EUR-Lex and European Commission AI Office materials for the EU; NIST, OMB, and White House materials for the U.S. federal side. citeturn5view0turn5view1turn27view0turn28view0turn23view0turn23view1turn25view0turn15view0turn15view1turn29search3

## How to divide the work between you and Codex

The clean division of labor is this:

The **human side** decides what the concepts mean, what counts as the relevant scope, and how ambiguous passages should be interpreted. Codex should not decide whether “binding,” “provider,” “general-purpose AI model,” or “model evaluation” mean one thing or another. Those are methodological choices, not parsing tasks. The most important human choices in this pilot are whether you are limiting the U.S. side to **federal cross-sector policy**, whether agency procurement rules count as “provider obligations,” and whether a voluntary code used to demonstrate conformity under EU law should be classified as voluntary or as a compliance pathway attached to a binding legal regime. citeturn27view0turn28view0turn22view2turn21view3

Codex, by contrast, should do the repetitive work: normalize document metadata, validate enums, generate fixture files, enforce source-locator requirements, compare interpretation profiles, and run scenarios. That is the right use of Codex because those tasks are mechanical once you have already chosen the concepts and reviewed the grounded examples. fileciteturn0file0

So the actual start point is not coding. It is a reviewed annotation sheet. That sheet becomes the seed for:

- `core/concepts.yml`
- `core/schema.json`
- `jurisdictions/eu/claims.writ`
- `jurisdictions/us/claims.writ`
- `core/scenarios.yml`
- `expected/judgments.json`

If the twenty reviewed examples are good, Codex has something concrete to implement against. If they are vague, Codex will start inventing structure too early. fileciteturn0file0

## Credible source set for the pilot

The source set below is enough to begin the pilot without drowning it in data.

### European Union core sources

The AI Act itself is the binding base text. Article 53 sets baseline obligations for providers of general-purpose AI models, including technical documentation, downstream documentation, copyright compliance policy, and public summary of training content. Article 55 adds model-evaluation, systemic-risk mitigation, incident-reporting, and cybersecurity obligations for providers of GPAI models with systemic risk. Article 113 gives the application timetable, including the 2 August 2025 application date for the GPAI parts of the Act. citeturn5view0turn5view1turn4view3

The Commission’s GPAI guidance and fact pages are the best interpretive sources for your first pilot because they state, in ordinary language, how the Commission interprets provider status, placing on the market, the 10^23 FLOP indicative GPAI threshold, the 10^25 FLOP systemic-risk presumption, the open-source exceptions, and the extra obligations for systemic-risk models. They also make explicit that the Code of Practice is voluntary but usable to demonstrate compliance. citeturn27view0turn26search1turn20search0turn28view0

### United States federal core sources

NIST’s AI RMF is the clearest cross-sector U.S. federal source for AI risk management. It states that the framework is intended to be voluntary and applies to organizations designing, developing, deploying, or using AI systems. The Generative AI Profile is also explicitly voluntary and is framed as a companion resource to the AI RMF for design, development, use, and evaluation of generative AI systems. The AI RMF Playbook says the framework and playbook are intended for voluntary use and that they organize guidance around the four functions Govern, Map, Measure, and Manage. citeturn23view0turn23view1turn25view0

CAISI is relevant because it shows that the U.S. federal government is building evaluation capacity. But CAISI’s official description emphasizes voluntary agreements with private-sector developers and evaluators, voluntary standards, and voluntary guidelines for automated benchmark evaluations. That is exactly why CAISI matters to the pilot: it is evidence of serious evaluation infrastructure without, by itself, creating a general binding provider duty across the market. citeturn24view0turn24view2turn24view3

The OMB memoranda matter because they create binding requirements for federal agencies, not for the public at large. M-25-21 explicitly says it governs only agencies’ own use of AI and creates no rights or obligations for the public; it also requires pre-deployment testing and AI impact assessments for high-impact agency AI. M-25-22 requires federal agencies procuring AI systems and services to test proposed solutions, include contract terms allowing ongoing monitoring and evaluation, and ensure compliance with M-25-21 in high-impact cases. These are important U.S. federal obligations, but they are best classified as **government-only binding**, not a general provider-evaluation rule. citeturn22view2turn22view0turn21view3

The White House materials are useful for confirming the broader federal posture. In January 2025 the White House said Executive Order 14179 revoked the prior Biden AI Executive Order and directed agencies to revise or rescind actions inconsistent with enhancing U.S. AI leadership. In December 2025 the White House said the government would protect AI innovation from what it called a patchwork of state laws and that the FTC and FCC should consider whether to adopt a federal reporting and disclosure standard for AI models. That is strong evidence of a current deregulatory federal stance plus possible future model-reporting action, not a general provider-evaluation obligation already in force. citeturn29search3turn29search6

## Proposed annotation sheet with twenty passages

These twenty entries are the right starting sheet. They are already narrow enough to seed your schema, but varied enough to stress-test whether the same concepts can describe both jurisdictions. The “Interpretation note” column is where your labor matters most.

### European Union passages

| ID | Source and locator | Actor affected | Conduct required or recommended | Legal force | Currently applicable | Authority | Proposed interpretation |
|---|---|---|---|---|---|---|---|
| EU-01 | AI Act, Art. 53(1), lines on technical documentation and evaluation results. citeturn5view0 | Provider of GPAI model | Draw up and maintain technical documentation, including training, testing, and evaluation results | Binding | Yes | AI Office; competent national authorities | Baseline GPAI obligation |
| EU-02 | AI Act, Art. 53(1)(b), downstream documentation obligations. citeturn5view0 | Provider of GPAI model | Provide information and documentation to downstream AI system providers | Binding | Yes | AI Office; competent national authorities | Documentation, not itself a model-evaluation duty |
| EU-03 | AI Act, Art. 53(1)(c). citeturn5view0 | Provider of GPAI model | Put in place a copyright-compliance policy | Binding | Yes | AI Office; competent national authorities | Relevant to transparency/compliance, not evaluation |
| EU-04 | AI Act, Art. 53(1)(d). citeturn5view0 | Provider of GPAI model | Publish sufficiently detailed summary of training content | Binding | Yes | AI Office | Public transparency requirement |
| EU-05 | AI Act, Art. 53(2). citeturn5view0 | Open-source GPAI provider | Possible exemption from some Art. 53 documentation obligations | Binding exception | Yes | AI Office | Exemption does not erase all obligations |
| EU-06 | AI Act, Art. 55(1)(a). citeturn5view1 | Provider of GPAI model with systemic risk | Perform model evaluation using standardized protocols and state-of-the-art tools; conduct and document adversarial testing | Binding | Yes | Commission / AI Office | This is the clearest EU positive example of a binding model-evaluation duty |
| EU-07 | AI Act, Art. 55(1)(b). citeturn5view1 | Provider of GPAI model with systemic risk | Assess and mitigate systemic risks at Union level | Binding | Yes | Commission / AI Office | Risk-management duty attached to systemic-risk models |
| EU-08 | AI Act, Art. 55(1)(c). citeturn5view1 | Provider of GPAI model with systemic risk | Track, document, and report serious incidents and corrective measures | Binding | Yes | AI Office and, where appropriate, national authorities | Incident-reporting obligation |
| EU-09 | AI Act, Art. 55(1)(d). citeturn5view1 | Provider of GPAI model with systemic risk | Ensure appropriate cybersecurity protection for model and model infrastructure | Binding | Yes | Commission / AI Office | Security duty attached to systemic-risk status |
| EU-10 | Commission GPAI guidelines: 10^23 FLOP indicative GPAI threshold; 10^25 FLOP systemic-risk presumption; two-week notification; code as compliance path. citeturn27view0 | Provider / possible provider | Determine whether model qualifies as GPAI; notify Commission if systemic-risk threshold is met; may rely on Code of Practice to show compliance | Mixed: interpretive guidance plus obligations it describes | Yes | Commission / AI Office | Treat the guidelines themselves as non-binding interpretation of binding law |
| EU-11 | AI Act, Art. 113 application timetable; old GPAI models must comply by 2 Aug 2027. citeturn4view3 | Provider of GPAI model | Observe staged application dates and transition timelines | Binding | Yes | Commission | Critical for `lifecycle_status` |
| EU-12 | AI Office signatory notice: Code signatories get streamlined compliance; Commission focuses enforcement on adherence to the code. citeturn28view0 | GPAI provider choosing to sign Code | Adhere to voluntary Code as a way to demonstrate compliance | Voluntary compliance mechanism within binding regime | Yes | Commission / AI Office | Good test case for “voluntary tool attached to binding rule” |

### United States federal passages

| ID | Source and locator | Actor affected | Conduct required or recommended | Legal force | Currently applicable | Authority | Proposed interpretation |
|---|---|---|---|---|---|---|---|
| US-01 | NIST AI RMF abstract. citeturn23view0 | Organizations designing, developing, deploying, or using AI | Use RMF to manage AI risks | Voluntary | Yes | NIST | Cross-sector risk framework, not binding law |
| US-02 | NIST AI RMF Playbook overview. citeturn25view0 | Organizations using RMF | Use Playbook suggestions across Govern, Map, Measure, Manage | Voluntary | Yes | NIST | Companion implementation guidance |
| US-03 | NIST Generative AI Profile abstract. citeturn23view1 | Organizations designing, developing, using, and evaluating GenAI | Use the Profile to incorporate trustworthiness considerations into design, development, use, and evaluation | Voluntary | Yes | NIST | Explicit evaluation-relevant guidance, but voluntary |
| US-04 | CAISI overview: voluntary agreements; unclassified evaluations. citeturn24view0 | Private-sector AI developers and evaluators | Participate in voluntary agreements and evaluations | Voluntary | Yes | NIST / CAISI | Evaluation infrastructure, not a market-wide duty |
| US-05 | CAISI guidelines page: voluntary guidelines and draft benchmark-evaluation practices. citeturn24view2turn24view3 | Advanced AI model, system, and agent developers or evaluators | Use voluntary guidelines and best practices for automated evaluations | Voluntary | Yes | NIST / CAISI | More evidence of evaluation science without binding status |
| US-06 | White House Jan. 2025 fact sheet: prior Biden AI EO revoked; agencies told to revise or rescind actions inconsistent with AI leadership. citeturn29search3 | Executive agencies; indirectly developers | Remove prior burdens inconsistent with new policy | Binding on executive branch, not directly on private providers | Yes | White House / executive agencies | Supports a deregulatory federal backdrop |
| US-07 | M-25-21 scope statement: governs agencies’ own use of AI and does not create rights or obligations for the public. citeturn22view2 | Federal agencies | Follow OMB agency-use requirements | Binding on agencies | Yes | OMB | Key scoping passage for excluding this from general provider duty |
| US-08 | M-25-21 high-impact AI: pre-deployment testing and AI impact assessment. citeturn22view0 | Federal agencies using high-impact AI | Conduct pre-deployment testing; complete AI impact assessment; discontinue non-compliant AI use | Binding on agencies | Yes | OMB / agencies | Strong government-use testing rule, not general private-market rule |
| US-09 | M-25-22 testing and evaluation in procurement. citeturn21view3 | Federal agencies procuring AI; vendors under contract | Agencies must test proposed solutions, require ongoing testing and monitoring, and preserve independent evaluation access | Binding in government procurement context | Yes | OMB / procuring agencies | Classify as `government_only_binding` |
| US-10 | M-25-22 disclosure and performance monitoring for contract AI use. citeturn21view1turn21view2 | Federal vendors performing government contracts | Provide documentation, support monitoring, and enable performance-based oversight | Binding in contract context | Yes | Procuring agencies / OMB | Binding only through government contract channel |
| US-11 | White House Dec. 2025 AI framework fact sheet: FTC/FCC to consider adopting a federal reporting and disclosure standard for AI models. citeturn29search6 | Potentially AI model companies in future | Possible future reporting/disclosure standard | Proposed / future-facing | Not yet | FTC / FCC if adopted | Good `proposed_only` test case |
| US-12 | White House AI policy-action sources: AI Action Plan and later White House materials emphasize innovation, infrastructure, standards, procurement, and security coordination. citeturn29search1turn19search4 | Federal agencies and ecosystem stakeholders | Standards, evaluation tools, and coordination emphasized | Mixed; mostly policy direction | Yes | White House, NIST, CAISI | Helpful context, but not itself a current provider-evaluation duty |

## What you need to decide before Codex starts

These are the human decisions that matter. If you do not answer them first, Codex will fill the gaps with accidental structure.

### Scope question

**Do you want the U.S. side to mean federal cross-sector policy only, or federal plus procurement and national-security policy?**

My recommended default is: **federal cross-sector plus federal procurement, but exclude national-security-only authorities from the first judgment.** That gives you a defensible comparison with the EU without pulling in specialized military governance that has no EU analogue in this pilot. M-25-21 itself excludes national security systems from its scope. citeturn22view2turn12search5

### Actor question

**Does “provider” include vendors selling AI systems to the government, or only providers placing a model on the market generally?**

My recommended default is: **use two actor types** — `market_provider` and `government_vendor`. That avoids flattening procurement obligations into general market obligations. The EU guidelines are explicit about “provider” and “placing on the market,” while the OMB memoranda are explicit that they govern agency use and acquisition. citeturn27view0turn22view2turn21view3

### Conduct question

**Does “model-evaluation requirement” include only direct testing duties, or also documentation of evaluation results?**

My recommended default is: **separate `model_evaluation`, `evaluation_documentation`, and `risk_assessment` as different conduct types.** That lets EU Article 53 and Article 55 sit in the same schema without pretending they are the same obligation. citeturn5view0turn5view1

### Legal-force question

**How will you classify the EU Code of Practice?**

My recommended default is: **`voluntary_compliance_path`** rather than simply `voluntary`. The code is voluntary, but it exists inside a binding legal regime and can be used to demonstrate compliance under the Act. citeturn27view0turn28view0

### Lifecycle question

**How will you distinguish “applicable,” “enforceable,” and “transition”?**

My recommended default is:
- `applicable` for obligations already in application,
- `enforcement_transition` where the authority has publicly announced a softer initial compliance phase,
- `transition_for_existing_models` where legacy models have a later deadline,
- `proposed_only` where the U.S. material merely contemplates future action. citeturn4view3turn0search4turn28view0turn29search6

### Judgment question

**What should count as a positive answer to the pilot question?**

My recommended default is:

> A jurisdiction counts as `binding_applicable` only if there is a currently applicable, legally compulsory obligation requiring model evaluation or adversarial testing for at least one clearly defined class of advanced or general-purpose AI model providers.

Under that rule, the EU qualifies for systemic-risk GPAI providers and the U.S. federal corpus does not. citeturn5view1turn27view0turn23view0turn22view2turn21view3

## What Codex should receive first

Once you answer the human questions above, Codex should not start by writing evaluator logic. It should first be given your reviewed examples and asked to build the minimal package around them.

The two most important outputs are the concept vocabulary and the normalized claim schema.

A sensible first-pass `concepts.yml` should include at least these enums:

```yaml
jurisdiction:
  - EU
  - US

actor_type:
  - market_provider
  - government_vendor
  - federal_agency
  - downstream_provider

legal_force:
  - binding
  - voluntary
  - voluntary_compliance_path
  - proposed
  - interpretive
  - unknown
  - contested

lifecycle_status:
  - applicable
  - enforcement_transition
  - transition_for_existing_models
  - proposed_only
  - unknown
  - contested

conduct_type:
  - model_evaluation
  - adversarial_testing
  - evaluation_documentation
  - downstream_documentation
  - risk_assessment
  - incident_reporting
  - cybersecurity_protection
  - training_content_summary
  - copyright_policy
  - procurement_testing
  - ongoing_monitoring
  - impact_assessment

authority_type:
  - AI_Office
  - European_Commission
  - national_competent_authority
  - NIST
  - CAISI
  - OMB
  - federal_agency
  - FTC
  - FCC

evidence_status:
  - accepted
  - unknown
  - contested
```

That vocabulary is broad enough to cover both jurisdictions without adding EU-specific or U.S.-specific evaluator branches. It also aligns with the Writ principle that the useful unit is a source-linked qualitative judgment rather than a score. fileciteturn0file0

The first claim fixture should stay extremely simple. Each record should preserve the exact local term, the normalized concept, the source locator, and your interpretation note. For example:

```yaml
claim_id: EU_06
jurisdiction: EU
actor_type: market_provider
actor_term_local: provider of a general-purpose AI model with systemic risk
conduct_type: model_evaluation
legal_force: binding
lifecycle_status: applicable
authority_type: AI_Office
source_locator: "AI Act, Article 55(1)(a)"
evidence_status: accepted
interpretation_note: "Counts as direct model-evaluation duty because article requires evaluation using standardized protocols plus documented adversarial testing."
```

That is where you begin. Not with a giant ingestion job. Not with a graph database. Not with scores.

You begin with one narrow question, twenty reviewed passages, one shared vocabulary, and one judgment rule that can survive the addition of a third jurisdiction later. That is the earliest point at which Writ can prove it is a reusable DSL rather than a one-off research script. fileciteturn0file0