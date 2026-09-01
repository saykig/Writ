import type { IndexedObject, RepositorySnapshot } from "../types.js";

export type RoutedSourceResolution =
  | { status: "missing"; matches: IndexedObject[] }
  | { status: "not_routed"; matches: IndexedObject[] }
  | { status: "ambiguous"; matches: IndexedObject[] }
  | {
      status: "resolved";
      source: IndexedObject;
      compatibilityVersion?: string;
      matches: IndexedObject[];
    };

function matching(
  snapshot: RepositorySnapshot,
  id: string,
  kinds: readonly string[],
): IndexedObject[] {
  const matches = snapshot.objects
    .filter((item) => kinds.includes(item.kind) && (item.id === id || item.aliases.includes(id)))
    .sort((left, right) => {
      const leftKey = `${left.file}\0${left.kind}\0${left.id}`;
      const rightKey = `${right.file}\0${right.kind}\0${right.id}`;
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
  const declarations = new Map<string, IndexedObject>();
  for (const match of matches) {
    // A reviewed compatibility source is indexed through both the generic
    // source loader and its exact document adapter. Those two views of the
    // same physical object are one declaration, not an authority ambiguity.
    const physicalObject = `${match.file}\0${match.id}`;
    const existing = declarations.get(physicalObject);
    if (!existing || (existing.kind === "source" && match.kind === "source_document")) {
      declarations.set(physicalObject, match);
    }
  }
  return [...declarations.values()];
}

function isRouted(snapshot: RepositorySnapshot, corpusId: string, object: IndexedObject): boolean {
  return snapshot.sourceRoutes.some(
    (route) => route.corpus_id === corpusId && route.file === object.file,
  );
}

/** Resolve a native evidence source only through a manifest-routed declaration. */
export function resolveRoutedSource(
  snapshot: RepositorySnapshot,
  corpusId: string,
  sourceId: string,
): RoutedSourceResolution {
  const direct = matching(snapshot, sourceId, ["source_document", "source"]);
  const mappings = matching(snapshot, sourceId, ["compatibility_source_identity"]);
  const routedDirect = direct.filter((candidate) => isRouted(snapshot, corpusId, candidate));
  const routedMappings = mappings.filter((candidate) => isRouted(snapshot, corpusId, candidate));
  const routedClaims = [...routedDirect, ...routedMappings];
  if (routedClaims.length > 1) return { status: "ambiguous", matches: routedClaims };
  if (routedDirect.length === 1) {
    return { status: "resolved", source: routedDirect[0]!, matches: routedDirect };
  }
  if (routedMappings.length === 0) {
    return direct.length > 0 || mappings.length > 0
      ? { status: "not_routed", matches: [...direct, ...mappings] }
      : { status: "missing", matches: [] };
  }

  const mapping = routedMappings[0]!;
  const targetId = mapping.value.compatibility_source_id;
  const compatibilityVersion = mapping.value.document_version_id;
  if (typeof targetId !== "string" || typeof compatibilityVersion !== "string") {
    return { status: "missing", matches: mappings };
  }
  const targets = matching(snapshot, targetId, ["source_document", "source"]);
  const routedTargets = targets.filter((candidate) => isRouted(snapshot, corpusId, candidate));
  if (routedTargets.length > 1) return { status: "ambiguous", matches: routedTargets };
  if (routedTargets.length === 0)
    return targets.length > 0
      ? { status: "not_routed", matches: targets }
      : { status: "missing", matches: [] };
  return {
    status: "resolved",
    source: routedTargets[0]!,
    compatibilityVersion,
    matches: routedTargets,
  };
}
