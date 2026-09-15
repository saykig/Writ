# Roadmap

## North star

Make difficult decision problems explicit enough to inspect, compute with established mathematics,
and check without requiring one domain, one solver, or an LLM.

## 1. Define the smallest useful decision object

Start with the structure shared by real decision problems: variables, dependencies or information
structure, uncertainty, actions, constraints, objectives, engine requests, and results.

Do not freeze a universal schema from the existing reference case. Compare the proposed object with
at least two established mathematical systems first.

**Exit gate:** the same core fields are useful across more than one mathematical family, and the
remaining engine-specific meaning can stay in typed profiles rather than being flattened.

## 2. Borrow mathematics before building it

Run small local donor trials. The first serious candidates are:

- DecisionProgramming.jl / JuMP for influence-diagram-style optimization;
- pyAgrum for Bayesian networks and influence diagrams; and
- POMDP tooling only when a sequential, partially observed problem actually requires it.

Other Python, Julia, R, Rust, Lean, or C++ tools are welcome when their mathematics fits better.
Writ should use their native strengths instead of translating everything into TypeScript.

**Exit gate:** each retained adapter has one executed example, exact version and license, a clear
input/output meaning, documented translation loss, and a useful checking story.

## 3. Build one local killer case

The first proving case does not need to be social science. It should be chosen because it puts the
architecture under pressure.

It must:

- run locally without an LLM or network service;
- contain interacting variables and genuine uncertainty;
- have competing actions plus constraints or an objective;
- make information available to the decision-maker explicit when timing matters;
- use an established mathematical engine;
- produce an inspectable Writ object and checked result; and
- be compared with using the underlying engine directly.

The case succeeds only if Writ makes something important easier to inspect, reuse, verify, or
compose than the raw engine workflow does.

## 4. Strengthen the trust boundary only when needed

Keep TypeScript for Writ's application and interchange layer while that remains simple. Keep donor
mathematics in its native ecosystem.

Test a small Rust checker when several result types need the same portable exact-checking layer.
Use Lean only when a stable theorem or checker property becomes important enough to justify formal
proof. Do not migrate languages for aesthetics.

## 5. Apply the substrate to harder domains

Once the domain-neutral object and local case are strong, test domains where decisions are harder to
repeat and harder to formalize: scientific operations, infrastructure, AI governance, and later
security and global affairs.

Domain-specific concepts should enter through typed profiles and supplied models, not by expanding
Writ core into a universal description of the world.
