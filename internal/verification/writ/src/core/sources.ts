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
  return snapshot.objects
    .filter((item) => kinds.includes(item.kind) && (item.id === id || item.aliases.includes(id)))
    .sort((left, right) => {
      const leftKey = `${left.file}\0${left.kind}\0${left.id}`;
      const rightKey = `${right.file}\0${right.kind}\0${right.id}`;
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
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
  if (direct.length > 1) return { status: "ambiguous", matches: direct };
  if (direct.length === 1) {
    return isRouted(snapshot, corpusId, direct[0]!)
      ? { status: "resolved", source: direct[0]!, matches: direct }
      : { status: "not_routed", matches: direct };
  }

  const mappings = matching(snapshot, sourceId, ["compatibility_source_identity"]);
  if (mappings.length > 1) return { status: "ambiguous", matches: mappings };
  if (mappings.length === 0) return { status: "missing", matches: [] };
  const mapping = mappings[0]!;
  if (!isRouted(snapshot, corpusId, mapping)) return { status: "not_routed", matches: mappings };
  const targetId = mapping.value.compatibility_source_id;
  const compatibilityVersion = mapping.value.document_version_id;
  if (typeof targetId !== "string" || typeof compatibilityVersion !== "string") {
    return { status: "missing", matches: mappings };
  }
  const targets = matching(snapshot, targetId, ["source_document", "source"]);
  if (targets.length > 1) return { status: "ambiguous", matches: targets };
  if (targets.length === 0) return { status: "missing", matches: [] };
  if (!isRouted(snapshot, corpusId, targets[0]!)) {
    return { status: "not_routed", matches: targets };
  }
  return {
    status: "resolved",
    source: targets[0]!,
    compatibilityVersion,
    matches: targets,
  };
}
