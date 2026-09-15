# `@writ/decision-case`

This package is a narrow reference implementation for exact mathematical input binding and
independent checking.

It can open a portable decision case, verify its declared source bytes and mathematical payload,
run one pinned local Python engine, receive a candidate result, and check that candidate separately
against the intended problem.

The supported mathematical profile is intentionally small: `finite-linear-uncertainty.v1` with the
pinned Decision Lab adapter, CPython 3.13, and SciPy. Unsupported semantics fail explicitly.

The package demonstrates boundaries Writ should keep:

- exact inputs are not silently reserialized;
- a producer result is treated as a candidate;
- the checker receives the intended problem independently;
- mathematical validity does not establish empirical validity; and
- no case file can provide an arbitrary command to execute.

This package is not the final decision-object format and should not be expanded into a general solver
registry. Richer mathematics should normally come from established external engines behind narrow
adapters.

Run the local unit tests with:

```bash
bun test packages/decision-case
```

The real integration test requires the separately pinned engine described by the test configuration.
