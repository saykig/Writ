import { describe, expect, test } from "bun:test";
import {
  all,
  and,
  any,
  isDefinitelyFalse,
  isDefinitelyTrue,
  not,
  or,
  truth,
  truthName,
  type Truth,
  type TruthName,
} from "../src/index.js";

const NAMES: readonly TruthName[] = ["true", "false", "unknown", "contested"];

// Canonical support-pair encoding, transcribed from 04_FORMAL_SEMANTICS.md §2.
const ENCODING: Record<TruthName, Truth> = {
  true: { supportsTrue: true, supportsFalse: false },
  false: { supportsTrue: false, supportsFalse: true },
  unknown: { supportsTrue: false, supportsFalse: false },
  contested: { supportsTrue: true, supportsFalse: true },
};

// not (t, f) = (f, t). §2.1
const NOT_TABLE: Record<TruthName, TruthName> = {
  true: "false",
  false: "true",
  unknown: "unknown",
  contested: "contested",
};

// §2.2 conjunction table (row = left operand, col = right operand).
const AND_TABLE: Record<TruthName, Record<TruthName, TruthName>> = {
  true: { true: "true", false: "false", unknown: "unknown", contested: "contested" },
  false: { true: "false", false: "false", unknown: "false", contested: "false" },
  unknown: { true: "unknown", false: "false", unknown: "unknown", contested: "false" },
  contested: { true: "contested", false: "false", unknown: "false", contested: "contested" },
};

// §2.3 disjunction table (row = left operand, col = right operand).
const OR_TABLE: Record<TruthName, Record<TruthName, TruthName>> = {
  true: { true: "true", false: "true", unknown: "true", contested: "true" },
  false: { true: "true", false: "false", unknown: "unknown", contested: "contested" },
  unknown: { true: "true", false: "unknown", unknown: "unknown", contested: "true" },
  contested: { true: "true", false: "contested", unknown: "true", contested: "contested" },
};

describe("support-pair encoding", () => {
  test("truth(name) matches the canonical (t, f) pairs", () => {
    for (const name of NAMES) {
      expect(truth(name).supportsTrue).toBe(ENCODING[name].supportsTrue);
      expect(truth(name).supportsFalse).toBe(ENCODING[name].supportsFalse);
    }
  });

  test("truthName is the inverse of truth for all four values", () => {
    for (const name of NAMES) {
      expect(truthName(truth(name))).toBe(name);
    }
  });
});

describe("not — exhaustive over all 4 values", () => {
  for (const a of NAMES) {
    test(`not ${a} = ${NOT_TABLE[a]}`, () => {
      expect(truthName(not(truth(a)))).toBe(NOT_TABLE[a]);
    });
  }

  test("not is an involution: not(not(x)) = x for all 4", () => {
    for (const a of NAMES) {
      expect(truthName(not(not(truth(a))))).toBe(a);
    }
  });
});

describe("and — exhaustive over all 4x4 = 16 pairs", () => {
  for (const a of NAMES) {
    for (const b of NAMES) {
      test(`${a} and ${b} = ${AND_TABLE[a][b]}`, () => {
        expect(truthName(and(truth(a), truth(b)))).toBe(AND_TABLE[a][b]);
      });
    }
  }

  test("key checks", () => {
    expect(truthName(and(truth("unknown"), truth("false")))).toBe("false");
    expect(truthName(and(truth("unknown"), truth("true")))).toBe("unknown");
    expect(truthName(and(truth("contested"), truth("false")))).toBe("false");
    expect(truthName(and(truth("contested"), truth("true")))).toBe("contested");
  });

  test("and is commutative across all pairs", () => {
    for (const a of NAMES) {
      for (const b of NAMES) {
        expect(truthName(and(truth(a), truth(b)))).toBe(truthName(and(truth(b), truth(a))));
      }
    }
  });
});

describe("or — exhaustive over all 4x4 = 16 pairs", () => {
  for (const a of NAMES) {
    for (const b of NAMES) {
      test(`${a} or ${b} = ${OR_TABLE[a][b]}`, () => {
        expect(truthName(or(truth(a), truth(b)))).toBe(OR_TABLE[a][b]);
      });
    }
  }

  test("key checks", () => {
    expect(truthName(or(truth("contested"), truth("true")))).toBe("true");
    expect(truthName(or(truth("contested"), truth("false")))).toBe("contested");
    expect(truthName(or(truth("unknown"), truth("true")))).toBe("true");
    expect(truthName(or(truth("unknown"), truth("false")))).toBe("unknown");
  });

  test("or is commutative across all pairs", () => {
    for (const a of NAMES) {
      for (const b of NAMES) {
        expect(truthName(or(truth(a), truth(b)))).toBe(truthName(or(truth(b), truth(a))));
      }
    }
  });
});

describe("De Morgan duality across all pairs", () => {
  test("not(a and b) = (not a) or (not b)", () => {
    for (const a of NAMES) {
      for (const b of NAMES) {
        const left = truthName(not(and(truth(a), truth(b))));
        const right = truthName(or(not(truth(a)), not(truth(b))));
        expect(left).toBe(right);
      }
    }
  });
});

describe("quantifiers", () => {
  test("empty forall is true; empty exists is false", () => {
    expect(truthName(all([]))).toBe("true");
    expect(truthName(any([]))).toBe("false");
  });

  test("all folds as conjunction", () => {
    expect(truthName(all([truth("true"), truth("true"), truth("true")]))).toBe("true");
    expect(truthName(all([truth("true"), truth("unknown")]))).toBe("unknown");
    expect(truthName(all([truth("true"), truth("false")]))).toBe("false");
    expect(truthName(all([truth("contested"), truth("false")]))).toBe("false");
    expect(truthName(all([truth("contested")]))).toBe("contested");
  });

  test("any folds as disjunction", () => {
    expect(truthName(any([truth("false"), truth("false")]))).toBe("false");
    expect(truthName(any([truth("false"), truth("unknown")]))).toBe("unknown");
    expect(truthName(any([truth("false"), truth("true")]))).toBe("true");
    expect(truthName(any([truth("false"), truth("contested")]))).toBe("contested");
    expect(truthName(any([truth("unknown")]))).toBe("unknown");
  });
});

describe("definite predicates", () => {
  test("isDefinitelyTrue only for true", () => {
    expect(isDefinitelyTrue(truth("true"))).toBe(true);
    expect(isDefinitelyTrue(truth("false"))).toBe(false);
    expect(isDefinitelyTrue(truth("unknown"))).toBe(false);
    expect(isDefinitelyTrue(truth("contested"))).toBe(false);
  });

  test("isDefinitelyFalse only for false", () => {
    expect(isDefinitelyFalse(truth("false"))).toBe(true);
    expect(isDefinitelyFalse(truth("true"))).toBe(false);
    expect(isDefinitelyFalse(truth("unknown"))).toBe(false);
    expect(isDefinitelyFalse(truth("contested"))).toBe(false);
  });

  test("unknown is never definitely true or false (no unknown-to-false collapse)", () => {
    expect(isDefinitelyTrue(truth("unknown"))).toBe(false);
    expect(isDefinitelyFalse(truth("unknown"))).toBe(false);
  });
});
