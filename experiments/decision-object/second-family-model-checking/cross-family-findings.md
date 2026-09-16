# Cross-family findings

The first proving family used influence diagrams. The second uses probabilistic model checking over a
finite Markov decision process. This note records what survived both.

## Stable mathematical identity

Results depend on stable mathematical objects, not display labels or container positions.

The influence-diagram case needed explicit node, state, table, and information-set identity. The
model-checking case needs explicit state, action, reward-model, and query-target identity.

Adapters may create engine-specific names, row indices, and syntax, but their bindings back to Writ
identity must remain explicit.

## The request is part of the problem

A mathematical model does not determine the question being asked of it.

The same lion MDP has different correct answers when the optimization direction changes or when the
stopping state changes. Writ therefore needs a typed mathematical request beside the model. Engine
property syntax is compiled from that request.

## Translation is a semantic boundary

Both families produced valid engine runs for the wrong mathematical object during adversarial tests.

The first case reordered compatible value tables. The solver still returned an optimum. The second
case showed that query targets and engine labels also require explicit binding. A successful engine
run establishes a result for the engine input; Writ checks that the input still means the declared
problem.

## Numeric domain belongs to the result boundary

The model-checking case made this concrete.

The ordinary double-precision Storm paths return the same optimal scheduler and about
`37732.6318503739` for the canonical request. Writ's independent rational checker evaluates that
scheduler at exactly `37750`.

The same Writ model and request were then compiled to Storm's exact-rational model checker. Storm also
returned exactly `37750`. The two query mutations agree in the same way: exact Storm and the
independent checker both return `0` for minimization and `7750` for stopping at `starving`.

A Writ result therefore needs enough metadata to distinguish the mathematical claim being made,
including the numeric domain and the guarantee attached to the value.

## Independent checks start from the Writ object

Both proving families were useful because checking returned to the original structured problem:

```text
Writ model + typed request
        |              |
        v              v
      adapter ------> engine
        |              |
        +---- result <-+
               |
               v
       independent check
        against Writ input
```

The checker does not merely ask whether the engine output is internally well formed. It checks what
that output means for the declared Writ problem.

## Family-specific structure

The influence-diagram profile keeps chance, decision, and value nodes; probability and utility
tables; information sets; and influence-diagram policies.

The probabilistic-model-checking profile keeps MDP transitions, reward models, temporal stopping
semantics, optimization direction, schedulers, Storm row groups, choice indices, generated labels,
and property syntax.

These remain typed profile concepts until another concrete case gives a reason to promote them.

## Shared candidates earned so far

The two families now support examining these concepts for Writ's shared layer:

- stable typed mathematical identity;
- model inputs separate from a typed mathematical request;
- explicit adapter bindings;
- engine and version metadata;
- numeric-domain and result-guarantee metadata;
- a typed engine result; and
- an independent-check record.

The next architecture step should promote only the smallest form of these concepts that both families
actually require.
