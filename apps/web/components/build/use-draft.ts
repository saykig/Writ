"use client";

/**
 * The draft, held in this browser and nowhere else.
 *
 * The stored draft is subscribed to as an external store rather than copied into
 * state on mount: the server and the first client pass both see nothing, and the
 * stored value arrives on the following render. That keeps hydration honest
 * without a cascading set in an effect.
 *
 * Edits live in ordinary state and shadow the stored draft until saved. A stored
 * draft from a different version is discarded rather than migrated — a
 * half-migrated draft that silently changes what a field meant is worse than an
 * empty form. A write that fails (private browsing refuses `setItem`) is
 * reported to the caller rather than thrown at the user.
 */

import * as React from "react";

import {
  DRAFT_STORAGE_KEY,
  DRAFT_VERSION,
  decodeDraft,
  emptyDraft,
  encodeDraft,
  type BuildDraft,
} from "@/lib/build-draft";

const KEY = `${DRAFT_STORAGE_KEY}:v${DRAFT_VERSION}`;

/** Saves in this tab do not raise `storage`, so they announce themselves. */
const DRAFT_EVENT = "writ:build-draft-saved";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(DRAFT_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DRAFT_EVENT, onChange);
  };
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    // An unreadable store is the same as an empty one.
    return null;
  }
}

const noStore = () => null;
const onClient = () => true;
const onServer = () => false;

export interface DraftHandle {
  draft: BuildDraft;
  /** False until the stored draft, if any, has been read. */
  ready: boolean;
  update: (patch: (draft: BuildDraft) => BuildDraft) => void;
  save: () => void;
  saveState: { savedAt: string | null; failed: boolean };
}

export function useDraft(): DraftHandle {
  const storedRaw = React.useSyncExternalStore(subscribe, readStored, noStore);
  const ready = React.useSyncExternalStore(subscribe, onClient, onServer);
  const [edited, setEdited] = React.useState<BuildDraft | null>(null);
  const [failed, setFailed] = React.useState(false);

  const blank = React.useMemo(() => emptyDraft(), []);
  const stored = React.useMemo(() => decodeDraft(storedRaw), [storedRaw]);
  const draft = edited ?? stored ?? blank;

  function update(patch: (current: BuildDraft) => BuildDraft) {
    setEdited(patch(draft));
  }

  function save() {
    const saved = { ...draft, savedAt: new Date().toISOString() };
    try {
      window.localStorage.setItem(KEY, encodeDraft(saved));
    } catch {
      setFailed(true);
      return;
    }
    setFailed(false);
    setEdited(saved);
    window.dispatchEvent(new Event(DRAFT_EVENT));
  }

  return { draft, ready, update, save, saveState: { savedAt: draft.savedAt, failed } };
}
