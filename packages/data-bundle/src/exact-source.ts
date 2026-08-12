import {
  isJudgmentDeclaration,
  isRecordDeclaration,
  parseDocument as parseWritDocument,
  spanOf,
} from "@writ/language";
import { isMap, isSeq, parseDocument as parseYamlDocument } from "yaml";

import { object, text, type Mapping } from "./repository.js";

export interface ExactYamlRecord {
  readonly value: Mapping;
  readonly source: string;
}

/** Slice each YAML sequence item from the original bytes and prove its identity reparses. */
export function extractYamlSequenceRecords(
  sourceText: string,
  collectionKey: string,
  identityKey: string,
): readonly ExactYamlRecord[] {
  const document = parseYamlDocument(sourceText, { keepSourceTokens: true, strict: true });
  if (document.errors.length > 0) {
    throw new Error(document.errors.map((error) => error.message).join("\n"));
  }
  const collection = document.get(collectionKey, true);
  if (!isSeq(collection)) throw new TypeError(`${collectionKey} must be a YAML sequence`);

  return collection.items.map((node, index) => {
    if (!node || !isMap(node) || !node.range) {
      throw new TypeError(`${collectionKey}[${index}] must be a ranged YAML map`);
    }
    const value = object(node.toJSON(), `${collectionKey}[${index}]`);
    const identity = text(value[identityKey], `${collectionKey}[${index}].${identityKey}`);
    const lineStart = sourceText.lastIndexOf("\n", node.range[0] - 1) + 1;
    const exactSource = sourceText.slice(lineStart, node.range[2]);
    const reparsed = parseYamlDocument(exactSource, { strict: true });
    const reparsedValue = reparsed.toJS();
    if (
      reparsed.errors.length > 0 ||
      !Array.isArray(reparsedValue) ||
      !reparsedValue[0] ||
      reparsedValue[0][identityKey] !== identity
    ) {
      throw new Error(`Exact YAML extraction failed for ${collectionKey}.${identity}`);
    }
    return { value, source: exactSource };
  });
}

/** Slice record and judgment declarations from Langium CST spans and prove their identity reparses. */
export function extractWritDeclarations(
  sourceText: string,
  fileName: string,
): {
  readonly records: ReadonlyMap<string, string>;
  readonly judgments: ReadonlyMap<string, string>;
} {
  const parsed = parseWritDocument(sourceText, { fileName });
  if (!parsed.ok) {
    throw new Error(`${fileName}: ${parsed.diagnostics.map((item) => item.message).join("; ")}`);
  }
  const records = new Map<string, string>();
  const judgments = new Map<string, string>();
  for (const declaration of parsed.model.declarations) {
    const isRecord = isRecordDeclaration(declaration);
    const isJudgment = isJudgmentDeclaration(declaration);
    if (!isRecord && !isJudgment) continue;
    const span = spanOf(declaration);
    if (!span) throw new Error(`${fileName}: ${declaration.name} has no source span`);
    const exactSource = sourceText.slice(span.offset, span.offset + span.length);
    const verification = parseWritDocument(
      `language writ "0.2"\npackage bundle.extraction.verify version "0.2.0";\n\n${exactSource}`,
      { fileName: `${fileName}#${declaration.name}` },
    );
    const identity = isRecord
      ? verification.model.declarations.find(isRecordDeclaration)?.name
      : verification.model.declarations.find(isJudgmentDeclaration)?.name;
    if (!verification.ok || identity !== declaration.name) {
      throw new Error(`${fileName}: exact Writ extraction failed for ${declaration.name}`);
    }
    (isRecord ? records : judgments).set(declaration.name, exactSource);
  }
  return { records, judgments };
}
