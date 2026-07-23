export type TruthName = "true" | "false" | "unknown" | "contested";

export interface Truth {
  readonly supportsTrue: boolean;
  readonly supportsFalse: boolean;
}

const VALUES: Record<TruthName, Truth> = {
  true: Object.freeze({ supportsTrue: true, supportsFalse: false }),
  false: Object.freeze({ supportsTrue: false, supportsFalse: true }),
  unknown: Object.freeze({ supportsTrue: false, supportsFalse: false }),
  contested: Object.freeze({ supportsTrue: true, supportsFalse: true }),
};

export function truth(name: TruthName): Truth {
  return VALUES[name];
}

export function truthName(value: Truth): TruthName {
  if (value.supportsTrue && value.supportsFalse) return "contested";
  if (value.supportsTrue) return "true";
  if (value.supportsFalse) return "false";
  return "unknown";
}

export function not(value: Truth): Truth {
  return {
    supportsTrue: value.supportsFalse,
    supportsFalse: value.supportsTrue,
  };
}

export function and(left: Truth, right: Truth): Truth {
  return {
    supportsTrue: left.supportsTrue && right.supportsTrue,
    supportsFalse: left.supportsFalse || right.supportsFalse,
  };
}

export function or(left: Truth, right: Truth): Truth {
  return {
    supportsTrue: left.supportsTrue || right.supportsTrue,
    supportsFalse: left.supportsFalse && right.supportsFalse,
  };
}

export function all(values: readonly Truth[]): Truth {
  return values.reduce(and, truth("true"));
}

export function any(values: readonly Truth[]): Truth {
  return values.reduce(or, truth("false"));
}

export function isDefinitelyTrue(value: Truth): boolean {
  return truthName(value) === "true";
}

export function isDefinitelyFalse(value: Truth): boolean {
  return truthName(value) === "false";
}
