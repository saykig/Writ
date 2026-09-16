# Roadmap

## North star

Make difficult decision problems explicit enough to inspect, compute with established mathematics,
and check across different mathematical families.

## 1. Define the smallest useful decision object

Start with the structure shared by real decision problems: variables, dependencies or information
structure, uncertainty, actions, constraints, objectives, engine requests, and results.

Compare the proposed object with at least two established mathematical systems before promoting
fields into the shared core.

**Exit gate:** the same core fields remain useful across more than one mathematical family, while
engine-specific meaning stays in typed profiles.

## 2. Exercise established mathematical engines

Run small local donor trials. The first serious candidates are:

- DecisionProgramming.jl / JuMP for influence-diagram-style optimization;
- pyAgrum for Bayesian networks and influence diagrams; and
- POMDP tooling when a sequential, partially observed problem requires it.

Python, Julia, R, Rust, Lean, C++, and other ecosystems can enter where their mathematics fits the
problem best.

**Exit gate:** each retained adapter has one executed example, exact version and license, a clear
input/output meaning, documented translation loss, and a useful checking story.

## 3. Build one local killer case

Choose a case because it puts the architecture under pressure.

The case should:

- run locally from structured inputs;
- contain interacting variables and genuine uncertainty;
- include competing actions plus constraints or an objective;
- make information available to the decision-maker explicit when timing matters;
- use an established mathematical engine;
- produce an inspectable Writ object and checked result; and
- use a direct-engine baseline with the same substantive inputs.

**Exit gate:** Writ makes an important operation easier to inspect, reuse, verify, or compose than the
direct engine workflow.

## 4. Strengthen the trust boundary when the cases earn it

Keep TypeScript for the application and interchange layer while it serves that role well. Keep donor
mathematics in its native ecosystem.

A small Rust checker becomes useful when several result types share the same portable exact-checking
need. Lean becomes useful when stable theorem or checker properties become repeated dependencies.

## 5. Apply the substrate to harder domains

After the domain-neutral object and local case are strong, test domains where decisions are harder to
repeat and harder to formalize: scientific operations, infrastructure, AI governance, and later
security and global affairs.

Domain-specific concepts enter through typed profiles and supplied models. The shared core remains
focused on decision structure that transfers across domains.
