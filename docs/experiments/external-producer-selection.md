# External producer selection — PR #53 first checkpoint

Status: bounded engineering addition under Proposed ADR 0029, not architecture acceptance.

## Inspect before choosing

- **SimPy 4.1.1 (MIT): selected.** Inspected the actual source distribution
  `sha256:06d0750a7884b11e0e8e20ce0bc7c6d4ed5f1743d456695340d13fdff95001a6`,
  its shared-resource example, `Resource._do_put/_do_get` and environment heap scheduling.
  The [upstream example](https://simpy.readthedocs.io/en/stable/simpy_intro/shared_resources.html)
  supplies the existing charging-station model; the [pinned source distribution](https://files.pythonhosted.org/packages/a8/66/860505ec021a16f9d8cf4b8c4d60ee07bb427649b643312303698c93b551/simpy-4.1.1.tar.gz)
  is the identity authority. The package has no runtime dependencies. Actual execution uses it.
- **EMA Workbench 2.5.3 (BSD-3-Clause metadata): deferred for this operation.** Inspected the
  [lake example](https://emaworkbench.readthedocs.io/en/latest/examples/example_lake_model.html)
  and [model implementation](https://emaworkbench.readthedocs.io/en/latest/examples/lake_models.html).
  These use sampled lognormal inflows, a nonlinear recurrence and SciPy root finding, with separate
  utility/inertia/reliability outputs. Package dependencies include NumPy, pandas, SALib, Platypus,
  scikit-learn and plotting/statistical packages. Useful for a later uncertainty study; no benefit
  here justifies that surface or pretending sample reliability is a robust guarantee. No EMA result
  was executed or claimed. Selection was based on a tractable receiving boundary, not outcome quality.

## Existing mathematics and tooling

Read Bellman main `58987d2389b6fc841a2b780cb45d4369d6a3e436`: north star, programme roadmap and
transfer architecture. Its current measurement-menu reference reuses supplied-prior exact
observation decisions; causal and strategic capabilities retain their explicit premises and transfer
limits. Read Decision Lab current main `e5f77dfcf929708951f4673b3f394461ef09c752` and actual pinned
Build 2 / certificate-transport contracts and Writ receiving code. They do not turn a simulator
trace into an empirical observation, supplied-prior model or sequential certificate.

Reuse the native checkers unchanged for native episode history. For simulation evidence, adapt the
established FIFO example and make only a small output adapter plus a separate integer recurrence
receiver. This is a format/numerical audit under explicit queue assumptions, not new Bellman
semantics. No gap currently warrants changes to Bellman or Decision Lab. A later request to derive
policy losses, uncertainty coverage or causal effects from simulator results would require a
justified model-to-query mapping first; importing such claims is explicitly unsupported here.

## Make / reuse / adapt and assurance

- Reuse SimPy scheduling/resource acquisition, existing exact JSON/byte identities and AJV.
- Adapt the upstream example's inputs and logging, preserving attribution and source identity.
- Make one closed external-result contract and one producer-free recipient boundary. Do not reuse
  PR #51's certificate label for the external output or generalize its mathematical profile.
- No new default Writ dependency: SimPy is required only for explicitly invoked reproduction.

Actual first-run bytes, pinned source manifest, MIT source/license and reproduction instructions
live under `examples/external-simulation/simpy-resource/`. Independent receiving checks identity,
format and exact finite trace agreement. Repeating the actual producer checks deterministic numerical
reproduction separately. Neither check validates the model empirically, authenticates an actor or
proves external execution provenance. The maintained surface is deliberately one integer FIFO
profile; no universal simulation adapter or solver registry is introduced.
