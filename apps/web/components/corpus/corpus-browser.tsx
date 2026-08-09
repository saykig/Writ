"use client";

/**
 * THESIS: Corpus is a reading index, not a database table; machine identity recedes until inspection.
 * OWN-WORLD: Writ's near-black field, hairline hierarchy, compact controls and restrained blue focus.
 * STORY: Move from jurisdiction to corpus to readable record, then inspect reviewed meaning and evidence.
 * FIRST VIEWPORT: Corpus purpose and counts lead into search; the first jurisdiction and its corpora are visible below.
 * FORM: A precisely specified grouped reading index inside Writ's established interior-route system; no concept seed.
 */
import * as React from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  EMPTY_CORPUS_FILTERS,
  filterCorpusRecords,
  filterValues,
  groupCorpusRecords,
  humanizeCorpusValue,
  type CorpusBrowserFilters,
} from "@/lib/corpus-browser-model";
import type { CorpusRecordDetail, CorpusRecordIndex } from "@/lib/corpus-record-types";
import { cn } from "@/lib/utils";
import { CorpusInspector } from "./corpus-inspector";

type InspectorState = "idle" | "loading" | "ready" | "not_found" | "error";

function replaceRecordUrl(recordKey: string | null, mode: "push" | "replace" = "push") {
  const url = new URL(window.location.href);
  if (recordKey) url.searchParams.set("record", recordKey);
  else url.searchParams.delete("record");
  window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", url);
}

function CompactSelect({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-[0.76rem] text-muted-foreground">
      <span className="shrink-0">{label}</span>
      <Select value={value} onValueChange={(nextValue) => onChange(String(nextValue))}>
        <SelectTrigger
          className="h-9 min-w-28 bg-background px-2.5 text-[0.78rem] text-foreground"
          aria-label={label}
        >
          <SelectValue>{value === "any" ? "Any" : humanizeCorpusValue(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent align="start" className="w-max min-w-(--anchor-width)">
          <SelectItem value="any">Any</SelectItem>
          {values.map((option) => (
            <SelectItem key={option} value={option}>
              {humanizeCorpusValue(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AdvancedFilters({
  records,
  filters,
  update,
}: {
  records: readonly CorpusRecordIndex[];
  filters: CorpusBrowserFilters;
  update: <Key extends keyof CorpusBrowserFilters>(
    key: Key,
    value: CorpusBrowserFilters[Key],
  ) => void;
}) {
  const familyRecords = records.filter(
    (record) => filters.family === "all" || record.family === filters.family,
  );
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-3 border-t border-border px-1 pt-4 pb-1">
      {filters.family === "legal_policy" ? (
        <>
          <CompactSelect
            label="Legal force"
            value={filters.legalForce}
            values={filterValues(familyRecords, "legalForce")}
            onChange={(value) => update("legalForce", value)}
          />
          <CompactSelect
            label="Adoption"
            value={filters.adoption}
            values={filterValues(familyRecords, "adoption")}
            onChange={(value) => update("adoption", value)}
          />
          <CompactSelect
            label="Applicability"
            value={filters.applicability}
            values={filterValues(familyRecords, "applicability")}
            onChange={(value) => update("applicability", value)}
          />
          <CompactSelect
            label="Enforcement"
            value={filters.enforcement}
            values={filterValues(familyRecords, "enforcement")}
            onChange={(value) => update("enforcement", value)}
          />
        </>
      ) : null}
      {filters.family === "institutional" ? (
        <CompactSelect
          label="Fact type"
          value={filters.factType}
          values={filterValues(familyRecords, "factType")}
          onChange={(value) => update("factType", value)}
        />
      ) : null}
      <CompactSelect
        label="Evidence"
        value={filters.evidence}
        values={filterValues(familyRecords, "traceState")}
        onChange={(value) => update("evidence", value as CorpusBrowserFilters["evidence"])}
      />
    </div>
  );
}

function CorpusGroupList({
  records,
  allRecords,
  selectedKey,
  onSelect,
  selectedButtonRef,
}: {
  records: readonly CorpusRecordIndex[];
  allRecords: readonly CorpusRecordIndex[];
  selectedKey: string | null;
  onSelect: (recordKey: string) => void;
  selectedButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
}) {
  const groups = groupCorpusRecords(records, allRecords);
  return (
    <div className="space-y-16">
      {(["EU", "US"] as const).map((jurisdiction) => {
        const jurisdictionGroups = groups.filter((group) => group.jurisdiction === jurisdiction);
        if (jurisdictionGroups.length === 0) return null;
        return (
          <section key={jurisdiction} aria-labelledby={`jurisdiction-${jurisdiction}`}>
            <h2
              id={`jurisdiction-${jurisdiction}`}
              className="border-b border-border pb-3 text-[0.74rem] font-medium tracking-[0.12em] text-muted-foreground uppercase"
            >
              {jurisdiction === "EU" ? "European Union" : "United States"}
            </h2>
            <div className="mt-9 space-y-12">
              {jurisdictionGroups.map((group) => {
                const filtered = group.records.length !== group.totalCount;
                const reviewWord = group.family === "institutional" ? "approved " : "";
                const count = filtered
                  ? `${group.records.length} of ${group.totalCount} ${reviewWord}records`
                  : `${group.totalCount} ${reviewWord}${group.totalCount === 1 ? "record" : "records"}`;
                return (
                  <section key={group.corpusId} aria-labelledby={`corpus-${group.corpusIndex}`}>
                    <header className="mb-3">
                      <h3
                        id={`corpus-${group.corpusIndex}`}
                        className="text-[1.32rem] font-medium tracking-[-0.025em]"
                      >
                        {group.corpusTitle}
                      </h3>
                      <p className="mt-1 text-[0.72rem] text-muted-foreground">
                        {humanizeCorpusValue(group.family)} ·{" "}
                        {group.corpusStatus === "draft" ? "Draft corpus" : "Active"} · {count}
                      </p>
                    </header>
                    <ul className="border-t border-border">
                      {group.records.map((record) => {
                        const selected = record.recordKey === selectedKey;
                        return (
                          <li key={record.recordKey} className="border-b border-border/70">
                            <button
                              ref={selected ? selectedButtonRef : undefined}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => onSelect(record.recordKey)}
                              className={cn(
                                "group/record grid min-h-16 w-full gap-2 px-1 py-3.5 text-left transition-colors sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6 sm:px-2",
                                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none",
                                selected ? "bg-muted/70" : "hover:bg-muted/35",
                              )}
                            >
                              <span className="min-w-0">
                                <span className="block text-[0.88rem] font-medium leading-5 text-foreground">
                                  {record.title}
                                </span>
                                <span className="mt-1 block text-[0.71rem] leading-5 text-muted-foreground">
                                  {[record.sourceLabel, record.locator].filter(Boolean).join(" · ")}
                                </span>
                              </span>
                              <span className="flex items-center gap-2 text-[0.66rem] text-muted-foreground sm:pt-0.5">
                                {record.legacyIds.length > 0 ? (
                                  <span>{record.displayId}</span>
                                ) : null}
                                {record.traceState !== "fully_traced" ? (
                                  <span>{humanizeCorpusValue(record.traceState)}</span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function CorpusBrowser({
  records,
  initialRecordKey,
}: {
  records: readonly CorpusRecordIndex[];
  initialRecordKey: string | null;
}) {
  const [filters, setFilters] = React.useState<CorpusBrowserFilters>(EMPTY_CORPUS_FILTERS);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(initialRecordKey);
  const [inspectorState, setInspectorState] = React.useState<InspectorState>(
    initialRecordKey ? "loading" : "idle",
  );
  const [detail, setDetail] = React.useState<CorpusRecordDetail | null>(null);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [mobileViewport, setMobileViewport] = React.useState(false);
  const selectedButtonRef = React.useRef<HTMLButtonElement | null>(null);

  const visibleRecords = React.useMemo(
    () => filterCorpusRecords(records, filters),
    [records, filters],
  );
  const legalCount = records.filter((record) => record.family === "legal_policy").length;
  const institutionalCount = records.length - legalCount;
  const activeAdvancedFilters = [
    filters.evidence,
    filters.legalForce,
    filters.adoption,
    filters.applicability,
    filters.enforcement,
    filters.factType,
  ].filter((value) => value !== "any").length;

  React.useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const syncViewport = () => setMobileViewport(query.matches);
    syncViewport();
    query.addEventListener("change", syncViewport);
    return () => query.removeEventListener("change", syncViewport);
  }, []);

  React.useEffect(() => {
    const onPopState = () => {
      const key = new URL(window.location.href).searchParams.get("record");
      setInspectorState(key ? "loading" : "idle");
      setDetail(null);
      setDetailError(null);
      setSelectedKey(key);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  React.useEffect(() => {
    if (!selectedKey) return;
    const controller = new AbortController();
    fetch(`/api/corpus/records/${encodeURIComponent(selectedKey)}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) {
          setInspectorState("not_found");
          setDetailError("That record is not present in the current corpus.");
          return;
        }
        if (!response.ok) throw new Error("The canonical record could not be loaded.");
        const value = (await response.json()) as CorpusRecordDetail;
        setDetail(value);
        setInspectorState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setInspectorState("error");
        setDetailError(
          "The canonical record could not be loaded. Clear the selection and try again.",
        );
      });
    return () => controller.abort();
  }, [selectedKey]);

  function updateFilter<Key extends keyof CorpusBrowserFilters>(
    key: Key,
    value: CorpusBrowserFilters[Key],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function updateFamily(value: CorpusBrowserFilters["family"]) {
    setFilters((current) => ({
      ...current,
      family: value,
      legalForce: "any",
      adoption: "any",
      applicability: "any",
      enforcement: "any",
      factType: "any",
    }));
  }

  function selectRecord(recordKey: string) {
    replaceRecordUrl(recordKey);
    setInspectorState("loading");
    setDetail(null);
    setDetailError(null);
    setSelectedKey(recordKey);
  }

  function clearSelection() {
    replaceRecordUrl(null, "replace");
    setInspectorState("idle");
    setDetail(null);
    setDetailError(null);
    setSelectedKey(null);
    requestAnimationFrame(() => selectedButtonRef.current?.focus());
  }

  function resetFilters() {
    setFilters(EMPTY_CORPUS_FILTERS);
  }

  return (
    <main className="mx-auto w-full max-w-[88rem] px-4 py-10 sm:px-6 lg:py-14">
      <header className="max-w-3xl">
        <p className="text-[0.72rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
          Corpus
        </p>
        <h1 className="mt-3 text-[clamp(2.5rem,6vw,5rem)] leading-[0.95] tracking-[-0.04em]">
          What Writ has structured.
        </h1>
        <p className="mt-5 max-w-2xl text-[1rem] leading-7 text-muted-foreground">
          Browse the records and evidence currently structured in Writ.
        </p>
        <p className="mt-3 text-[0.75rem] text-muted-foreground">
          <span className="text-foreground">{records.length} records</span> · {legalCount} legal
          policy · {institutionalCount} institutional
        </p>
      </header>

      <section aria-label="Corpus controls" className="mt-10 space-y-4">
        <label className="relative block max-w-2xl">
          <span className="sr-only">Search records</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search records…"
            className="h-11 w-full rounded-lg border border-input bg-background pr-10 pl-10 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          {filters.search ? (
            <button
              type="button"
              onClick={() => updateFilter("search", "")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex rounded-lg border border-input p-0.5"
            aria-label="Jurisdiction filter"
          >
            {(["all", "EU", "US"] as const).map((jurisdiction) => (
              <button
                key={jurisdiction}
                type="button"
                aria-pressed={filters.jurisdiction === jurisdiction}
                onClick={() => updateFilter("jurisdiction", jurisdiction)}
                className={cn(
                  "min-h-9 rounded-md px-3 text-[0.76rem] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  filters.jurisdiction === jurisdiction
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {jurisdiction === "all" ? "All" : jurisdiction}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[0.76rem] text-muted-foreground">
            <span>Family</span>
            <Select
              value={filters.family}
              onValueChange={(value) =>
                updateFamily(String(value) as CorpusBrowserFilters["family"])
              }
            >
              <SelectTrigger
                className="h-10 min-w-28 bg-background px-2.5 text-[0.78rem] text-foreground"
                aria-label="Family"
              >
                <SelectValue>
                  {filters.family === "all" ? "All" : humanizeCorpusValue(filters.family)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="legal_policy">Legal policy</SelectItem>
                <SelectItem value="institutional">Institutional</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <button
            type="button"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-[0.76rem] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              filtersOpen || activeAdvancedFilters > 0
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <SlidersHorizontal className="size-3.5" aria-hidden />
            Filters{activeAdvancedFilters > 0 ? ` · ${activeAdvancedFilters}` : ""}
          </button>
        </div>

        {filtersOpen ? (
          <AdvancedFilters records={records} filters={filters} update={updateFilter} />
        ) : null}
      </section>

      <div
        className="mt-8 flex items-center justify-between gap-4 border-b border-border pb-3 text-[0.72rem] text-muted-foreground"
        aria-live="polite"
      >
        <span>
          {visibleRecords.length === records.length
            ? `${records.length} records`
            : `${visibleRecords.length} of ${records.length} records`}
        </span>
        {filters !== EMPTY_CORPUS_FILTERS &&
        (filters.search ||
          filters.jurisdiction !== "all" ||
          filters.family !== "all" ||
          activeAdvancedFilters > 0) ? (
          <button
            type="button"
            onClick={resetFilters}
            className="text-foreground/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Reset filters
          </button>
        ) : null}
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem] xl:gap-16">
        <div className="min-w-0">
          {visibleRecords.length > 0 ? (
            <CorpusGroupList
              records={visibleRecords}
              allRecords={records}
              selectedKey={selectedKey}
              onSelect={selectRecord}
              selectedButtonRef={selectedButtonRef}
            />
          ) : (
            <div className="py-20 text-center">
              <p className="text-lg font-medium">No records match this view.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Clear the search or reset the filters to browse the corpus again.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-5 text-sm font-medium text-primary hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>

        <aside
          aria-label="Record inspector"
          className="sticky top-24 hidden max-h-[calc(100dvh-7rem)] self-start overflow-y-auto rounded-xl border border-border bg-card lg:block"
        >
          {!mobileViewport ? (
            <CorpusInspector
              state={inspectorState}
              detail={detail}
              error={detailError}
              onClose={clearSelection}
            />
          ) : null}
        </aside>
      </div>

      <Sheet
        open={Boolean(selectedKey) && mobileViewport}
        onOpenChange={(open) => !open && clearSelection()}
      >
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[88dvh] gap-0 overflow-y-auto rounded-t-xl p-0 lg:hidden"
        >
          <SheetTitle className="sr-only">Record inspector</SheetTitle>
          <CorpusInspector
            state={inspectorState}
            detail={detail}
            error={detailError}
            onClose={clearSelection}
          />
        </SheetContent>
      </Sheet>
    </main>
  );
}
