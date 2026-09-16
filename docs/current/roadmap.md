# Roadmap

## North star

Make difficult decision problems explicit enough to inspect, compute with established mathematics,
and check across different mathematical families.

## 1. Prove one bounded decision workflow

Start with one problem and the established mathematical engine that fits it best. Build only the
smallest Writ object and adapter needed to run that problem locally.

The first proving case should test a semantic boundary that matters. The initial candidate is a
limited-memory influence diagram where later decisions have a deliberately restricted information
set. Writ should preserve that information boundary across the adapter and reject a translated model
or returned policy that uses information unavailable at the decision point.

Use the same substantive model directly through the donor engine as the baseline. If the direct
engine already provides the same useful guarantee, revise the case inside this gate rather than
promoting a weak demonstration.

**Exit gate:** Writ makes one material operation easier to inspect, verify, reuse, or compose than the
direct-engine workflow.

## 2. Test the useful structure with a second mathematical system

After the first case earns its place, choose a second established system that stresses different
parts of the representation. Keep each engine in its native ecosystem and add only a thin adapter.

Initial donor candidates include DecisionProgramming.jl / JuMP, pyAgrum, POMDP tooling, and other
mature Python, Julia, R, Rust, Lean, or C++ systems whose mathematics fits a concrete problem.

**Exit gate:** we can identify which structure transfers across the two systems and which structure
belongs only to an engine-specific profile.

## 3. Promote the smallest shared decision object

Promote fields into Writ core only after the proving work shows that they carry useful meaning across
more than one mathematical system.

Keep engine-specific probability models, utility structures, solver options, proof objects, and other
specialized semantics in typed profiles.

**Exit gate:** the shared object contains only structure supported by the proving cases, with exact
translation boundaries and clear unsupported states.

## 4. Strengthen the trust boundary when the cases earn it

Keep TypeScript for the application and interchange layer while it serves that role well. Keep donor
mathematics in its native ecosystem.

A small Rust checker becomes useful when several result types share the same portable exact-checking
need. Lean becomes useful when stable theorem or checker properties become repeated dependencies.
Julia, Python, R, C++, and other languages can own mathematical work when their existing ecosystems
already provide the right machinery.

## 5. Apply the substrate to harder domains

After the shared object and local proving cases are strong, test domains where decisions are harder
to repeat and harder to formalize: scientific operations, infrastructure, AI governance, and later
security and global affairs.

Domain-specific concepts enter through typed profiles and supplied models. The shared core remains
focused on decision structure that transfers across domains.
