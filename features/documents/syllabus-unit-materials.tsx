"use client";

import * as React from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  LoaderCircle,
  Plus,
  Search,
} from "lucide-react";
import { ChatMarkdown } from "@/features/chat/chat-markdown";
import { ClassPageHeader } from "@/components/shared/ClassPageHeader";
import { SyllabusRow, SyllabusTable } from "@/components/shared/SyllabusTable";
import { Button } from "@/components/ui/button";
import { AUTH_TOKEN_KEY } from "@/components/ui/nav-config";
import {
  ApiError,
  approveDocument,
  fetchTeacherSyllabus,
  uploadDocuments,
  type DocumentItem,
  type DocumentStatus,
  type SyllabusMaterial,
  type TeacherSyllabus,
} from "@/lib/documents";

const STATUS_LABEL: Record<DocumentStatus, string> = {
  pending: "Pending approval",
  processing: "Processing",
  indexed: "Ready",
  rejected: "Rejected",
  failed: "Failed",
  replaced: "Replaced",
};

const STATUS_TONE: Record<DocumentStatus, string> = {
  pending: "border-[#ECDCB8] bg-[#FFF9EA] text-[#8F6B16]",
  processing: "border-[#DADADA] bg-[#F7F7F7] text-[#5A5A5A]",
  indexed: "border-[#BCD9C9] bg-[#EFF8F3] text-[#3B7D5D]",
  rejected: "border-[#DFB2A6] bg-[#FBF1EE] text-[#9D4C38]",
  failed: "border-[#DFB2A6] bg-[#FBF1EE] text-[#9D4C38]",
  replaced: "border-[#DADADA] bg-[#F7F7F7] text-[#5A5A5A]",
};

function stripNotesLines(markdown: string): string {
  return markdown
    .split("\n")
    .filter((line) => !/^\s*[-*+]\s+\*Notes:\*/i.test(line))
    .join("\n");
}

export function SyllabusUnitMaterials({
  classId,
  refreshKey = 0,
  changeSource = "initial",
  onChanged,
  embedded = false,
}: {
  classId: string;
  refreshKey?: number;
  changeSource?: string;
  onChanged?: (source: string) => void;
  embedded?: boolean;
}) {
  const [syllabus, setSyllabus] = React.useState<TeacherSyllabus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadingUnit, setUploadingUnit] = React.useState<number | null>(null);
  const [uploadNote, setUploadNote] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [approvingSyllabus, setApprovingSyllabus] = React.useState(false);
  const [approveError, setApproveError] = React.useState<string | null>(null);
  const [approveNote, setApproveNote] = React.useState<string | null>(null);
  const [expandedUnits, setExpandedUnits] = React.useState<Record<number, boolean>>({});
  const fileInputRefs = React.useRef<Record<number, HTMLInputElement | null>>({});
  const loadedDocumentId = React.useRef<string | null>(null);
  const loadSeq = React.useRef(0);

  const load = React.useCallback(async () => {
    const seq = ++loadSeq.current;
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setError("Session expired - please log in again.");
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await fetchTeacherSyllabus({ token }, classId);
      if (seq === loadSeq.current) setSyllabus(data);
    } catch (err) {
      if (seq === loadSeq.current) {
        setError(err instanceof Error ? err.message : "Could not load syllabus units.");
      }
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [classId]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount/class fetch; state updates happen after await.
    void load();
  }, [load]);

  React.useEffect(() => {
    if (refreshKey === 0 || changeSource === "units") return;
    // Sibling mutations (general upload, attach, material approve/delete)
    // reload this panel; a unit-origin change already reloaded locally.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external signal; load updates after await.
    void load();
  }, [refreshKey, changeSource, load]);

  const documentId = syllabus?.documentId ?? null;
  React.useEffect(() => {
    // A different syllabus must not keep stale expanded unit indexes. Refreshes
    // of the same syllabus keep the teacher's expanded/collapsed state.
    if (loadedDocumentId.current !== documentId) {
      loadedDocumentId.current = documentId;
      setExpandedUnits({});
    }
  }, [documentId]);

  // Keep the uploaded rows visible while the follow-up refresh is in flight.
  // Without this the unit sits on "Adding…" until that request resolves (or
  // forever when it fails) even though the backend already accepted the file.
  function mergeUploadedMaterials(unitNumber: number, uploaded: DocumentItem[]) {
    if (uploaded.length === 0) return;
    setSyllabus((current) => {
      if (!current) return current;
      const known = new Set(
        current.units.flatMap((unit) => unit.materials.map((material) => material.id)),
      );
      const additions = uploaded.filter((item) => !known.has(item.id));
      if (additions.length === 0) return current;
      return {
        ...current,
        totalMaterialCount: current.totalMaterialCount + additions.length,
        units: current.units.map((unit) =>
          unit.unitNumber === unitNumber
            ? {
                ...unit,
                materials: [
                  ...unit.materials,
                  ...additions.map(
                    (item): SyllabusMaterial => ({
                      id: item.id,
                      fileName: item.fileName,
                      status: item.status,
                      failureReason: item.failureReason,
                      version: item.version,
                      createdAt: item.createdAt,
                    }),
                  ),
                ],
              }
            : unit,
        ),
      };
    });
  }

  async function handleFiles(unitNumber: number, files: FileList | null) {
    if (!files || files.length === 0 || !syllabus?.documentId) return;
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setError("Session expired - please log in again.");
      return;
    }
    setUploadingUnit(unitNumber);
    setUploadError(null);
    setUploadNote(null);
    let added: DocumentItem[] = [];
    try {
      const outcomes = await uploadDocuments({ token }, classId, Array.from(files), {
        syllabusDocumentId: syllabus.documentId,
        unitNumber,
      });
      const failed = outcomes.filter((outcome) => outcome.error !== null);
      added = outcomes
        .filter((outcome) => outcome.error === null && outcome.item)
        .map((outcome) => outcome.item as DocumentItem);

      if (failed.length > 0) {
        setUploadError(failed.map((outcome) => `${outcome.fileName}: ${outcome.error}`).join(" "));
      }
      if (added.length > 0) {
        mergeUploadedMaterials(unitNumber, added);
        setUploadNote(
          `Added ${added.length} material${added.length === 1 ? "" : "s"} to Unit ${unitNumber}. Approve the material to make it ready.`,
        );
      }
    } catch (err) {
      setUploadError(
        err instanceof ApiError
          ? `Upload failed: ${err.message}`
          : "Upload failed. Check the backend connection and try again.",
      );
    } finally {
      setUploadingUnit(null);
    }

    // The upload response is enough to show the new rows; the refresh below
    // reconciles statuses/counts and must not gate the spinner or the sibling
    // materials table.
    if (added.length > 0) {
      onChanged?.("units");
      await load();
    }
  }

  async function handleApproveSyllabus() {
    if (!syllabus?.documentId || !syllabus.canApprove || approvingSyllabus) return;
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setApproveError("Session expired - please log in again.");
      return;
    }
    setApprovingSyllabus(true);
    setApproveError(null);
    setApproveNote(null);
    try {
      await approveDocument({ token }, syllabus.documentId);
      setApproveNote("Syllabus approved. Processing it now; students will see it once indexing completes.");
      await load();
      onChanged?.("units");
    } catch (err) {
      setApproveError(
        err instanceof ApiError
          ? `Approve failed: ${err.message}`
          : "Approve failed. Check the connection and try again.",
      );
    } finally {
      setApprovingSyllabus(false);
    }
  }

  if (loading && !syllabus) {
    return (
      <section className="mt-8 space-y-3" aria-labelledby="syllabus-units-heading">
        <h2 id="syllabus-units-heading" className="text-[15px] font-bold text-[#111111]">
          Syllabus units
        </h2>
        <p className="flex items-center gap-2 rounded-lg border border-[#DADADA] bg-white px-4 py-6 text-[13px] text-[#5A5A5A]">
          <LoaderCircle className="size-4 animate-spin" /> Loading draft syllabus.
        </p>
      </section>
    );
  }

  if (!syllabus?.documentId) {
    return (
      <section className="mt-8 space-y-3" aria-labelledby="syllabus-units-heading">
        <h2 id="syllabus-units-heading" className="text-[15px] font-bold text-[#111111]">
          Syllabus units
        </h2>
        <p className="rounded-lg border border-[#DADADA] bg-white px-4 py-8 text-center text-[13px] text-[#5A5A5A]">
          {error ?? "No syllabus roadmap yet - upload a Syllabus file in Materials below."}
        </p>
      </section>
    );
  }

  const query = search.trim().toLowerCase();
  const filteredUnits = query
    ? syllabus.units.filter(
        (unit) =>
          unit.unitTitle.toLowerCase().includes(query) ||
          (unit.description ?? "").toLowerCase().includes(query) ||
          unit.content.toLowerCase().includes(query),
      )
    : syllabus.units;
  const approveBlocked = !syllabus.canApprove;

  const statusMessages = (
    <>
      {error && (
        <p role="alert" className="rounded-lg border border-[#DFB2A6] bg-[#FBF1EE] px-4 py-3 text-[13px] text-[#9D4C38]">
          {error}
        </p>
      )}
      {uploadError && (
        <p role="alert" className="rounded-lg border border-[#DFB2A6] bg-[#FBF1EE] px-4 py-3 text-[13px] text-[#9D4C38]">
          {uploadError}
        </p>
      )}
      {uploadNote && (
        <p className="rounded-lg border border-[#BCD9C9] bg-[#EFF8F3] px-4 py-3 text-[13px] text-[#3B7D5D]">
          {uploadNote}
        </p>
      )}
      {approveError && (
        <p role="alert" className="rounded-lg border border-[#DFB2A6] bg-[#FBF1EE] px-4 py-3 text-[13px] text-[#9D4C38]">
          {approveError}
        </p>
      )}
      {approveNote && (
        <p className="rounded-lg border border-[#BCD9C9] bg-[#EFF8F3] px-4 py-3 text-[13px] text-[#3B7D5D]">
          {approveNote}
        </p>
      )}
    </>
  );

  function renderMaterials(
    unit: TeacherSyllabus["units"][number],
    compact = false,
  ) {
    return (
      <div className={compact ? "space-y-2" : "mt-4 border-t border-[#EFEFEF] pt-3"}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[12px] font-bold uppercase tracking-wide text-[#6F6F6F]">
            Materials ({unit.materials.length})
          </h4>
          <button
            type="button"
            aria-label={`Add materials to Unit ${unit.unitNumber}: ${unit.unitTitle}`}
            onClick={() => fileInputRefs.current[unit.unitNumber]?.click()}
            disabled={uploadingUnit === unit.unitNumber}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-[#CFCFCF] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#111111] hover:bg-[#F0F0F0] disabled:opacity-60"
          >
            {uploadingUnit === unit.unitNumber ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            + Add materials
          </button>
          <input
            ref={(node) => {
              fileInputRefs.current[unit.unitNumber] = node;
            }}
            type="file"
            multiple
            tabIndex={-1}
            aria-hidden="true"
            className="hidden"
            accept=".pdf,.docx,.md,.txt,.pptx,.xlsx"
            onChange={(event) => {
              void handleFiles(unit.unitNumber, event.target.files);
              event.target.value = "";
            }}
          />
        </div>

        {unit.materials.length === 0 ? (
          <p className="mt-3 rounded border border-dashed border-[#DADADA] bg-white px-3 py-3 text-[12.5px] text-[#6F6F6F]">
            <FilePlus2 className="mr-1.5 inline size-3.5" />
            No materials yet - you can add them later.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[#EFEFEF] rounded border border-[#EFEFEF] bg-white">
            {unit.materials.map((material) => (
              <li
                key={material.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[12.5px]"
              >
                <span className="min-w-0 truncate text-[#111111]">{material.fileName}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_TONE[material.status]}`}
                >
                  {STATUS_LABEL[material.status]}
                </span>
                {material.status === "failed" && material.failureReason && (
                  <span className="w-full text-[11px] text-[#9D4C38]">
                    {material.failureReason}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (embedded) {
    return (
      <section className="space-y-3" aria-labelledby="syllabus-unit-materials-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3
              id="syllabus-unit-materials-heading"
              className="text-[14px] font-bold text-[#111111]"
            >
              Unit materials
            </h3>
            <p className="mt-0.5 text-[12.5px] text-[#5A5A5A]">
              Add supporting files to a unit. New materials stay pending until approved.
            </p>
          </div>
          {syllabus.isDraft && syllabus.status === "pending" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-[#5A5A5A]">
                {syllabus.canApprove
                  ? "Ready for approval."
                  : "Approval is blocked until one material is approved and indexed."}
              </span>
              <Button
                type="button"
                onClick={() => void handleApproveSyllabus()}
                disabled={approveBlocked || approvingSyllabus}
                title={
                  approveBlocked
                    ? "Approve requires at least one ready material linked to this syllabus."
                    : undefined
                }
                className="border-[#111111] bg-[#111111] text-white hover:bg-[#333]"
              >
                {approvingSyllabus ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <CheckCircle2 />
                )}
                Approve syllabus
              </Button>
            </div>
          )}
        </div>
        {syllabus.isDraft && syllabus.status !== "pending" && (
          <p className="rounded-lg border border-[#DADADA] bg-white px-4 py-3 text-[13px] text-[#5A5A5A]">
            Syllabus approved and processing. Students see it after indexing.
          </p>
        )}
        {statusMessages}
        {syllabus.units.length === 0 ? (
          <p className="rounded-lg border border-[#DADADA] bg-white px-4 py-8 text-center text-[13px] text-[#5A5A5A]">
            No units were parsed from this syllabus yet.
          </p>
        ) : (
          <SyllabusTable toolbar={undefined}>
            {syllabus.units.map((unit) => (
              <SyllabusRow
                key={unit.unitNumber}
                unitNumber={String(unit.unitNumber).padStart(2, "0")}
                unitName={unit.unitTitle}
                description={unit.description ?? `${unit.materials.length} materials`}
                content={renderMaterials(unit, true)}
              />
            ))}
          </SyllabusTable>
        )}
      </section>
    );
  }

  return (
    <section className="mt-8 space-y-3" aria-labelledby="syllabus-units-heading">
      <ClassPageHeader
        id="syllabus-units-heading"
        title="Syllabus"
        subtitle={`${syllabus.isDraft ? "Draft preview" : "Approved syllabus"} - ${syllabus.readyMaterialCount} ready / ${syllabus.totalMaterialCount} material${syllabus.totalMaterialCount === 1 ? "" : "s"}`}
        badge={
          <span
            title={syllabus.fileName ?? undefined}
            className="max-w-[280px] truncate rounded-md border border-[#DADADA] bg-white px-2 py-1 text-[11.5px] font-medium text-[#5A5A5A]"
          >
            {syllabus.fileName}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1.5 h-4 w-4 text-[#6F6F6F]" />
              <input
                type="text"
                placeholder="Search units"
                aria-label="Search syllabus units"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-48 rounded border border-[#DADADA] bg-white py-1.5 pl-8 pr-3 text-[12.5px] text-[#111111] outline-none focus:border-[#111111]"
              />
            </div>
            {syllabus.isDraft && syllabus.status === "pending" && (
              <Button
                type="button"
                onClick={() => void handleApproveSyllabus()}
                disabled={approveBlocked || approvingSyllabus}
                title={
                  approveBlocked
                    ? "Approve requires at least one ready material linked to this syllabus."
                    : undefined
                }
                className="border-[#111111] bg-[#111111] text-white hover:bg-[#333]"
              >
                {approvingSyllabus ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <CheckCircle2 />
                )}
                Approve syllabus
              </Button>
            )}
          </div>
        }
      />

      {syllabus.isDraft && syllabus.status !== "pending" && (
        <p className="rounded-lg border border-[#DADADA] bg-white px-4 py-3 text-[13px] text-[#5A5A5A]">
          Syllabus approved and processing. Students will see it and its approved materials after indexing.
        </p>
      )}

      {syllabus.isDraft && syllabus.status === "pending" && (
        <div
          className={`rounded-lg border px-4 py-3 text-[13px] ${
            syllabus.canApprove
              ? "border-[#BCD9C9] bg-[#EFF8F3] text-[#3B7D5D]"
              : "border-[#ECDCB8] bg-[#FFF9EA] text-[#8F6B16]"
          }`}
        >
          {syllabus.canApprove ? (
            <span className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              Ready for approval: at least one material on this syllabus is indexed. Other units may stay empty.
            </span>
          ) : (
            <span>
              Approval is blocked until at least one material in any unit is approved and indexed. Add material
              below, then approve it in the materials table.
            </span>
          )}
        </div>
      )}

      {!syllabus.isDraft && (
        <p className="rounded-lg border border-[#DADADA] bg-white px-4 py-3 text-[13px] text-[#5A5A5A]">
          This syllabus is approved. You can still add materials to any unit.
        </p>
      )}

      {statusMessages}

      {/* Syllabus-level materials are surfaced in the Materials table below;
          do not repeat them here. Gate counts above still include them. */}
      {syllabus.units.length === 0 ? (
        <p className="rounded-lg border border-[#DADADA] bg-white px-4 py-8 text-center text-[13px] text-[#5A5A5A]">
          No units were parsed from this syllabus yet.
        </p>
      ) : filteredUnits.length === 0 ? (
        <p className="rounded-lg border border-[#DADADA] bg-white px-4 py-8 text-center text-[13px] text-[#5A5A5A]">
          No units match &ldquo;{search.trim()}&rdquo;.
        </p>
      ) : (
        <div className="divide-y divide-[#DADADA] overflow-hidden rounded-lg border border-[#DADADA] bg-white">
          {filteredUnits.map((unit) => {
            const expanded = Boolean(expandedUnits[unit.unitNumber]);
            const panelId = `syllabus-unit-panel-${unit.unitNumber}`;
            const headerId = `syllabus-unit-header-${unit.unitNumber}`;
            return (
              <div key={unit.unitNumber}>
                <button
                  id={headerId}
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() =>
                    setExpandedUnits((current) => ({
                      ...current,
                      [unit.unitNumber]: !current[unit.unitNumber],
                    }))
                  }
                  className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-[#FAFAFA]"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span className="inline-flex h-7 w-9 shrink-0 items-center justify-center rounded border border-[#E2E2E2] bg-slate-50 font-mono text-[12.5px] font-bold text-[#5A5A5A]">
                      {String(unit.unitNumber).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <span className="block truncate text-[14px] font-bold text-[#111111]">
                        {unit.unitTitle}
                      </span>
                      {unit.description && (
                        <span className="mt-0.5 block text-[12px] text-[#5A5A5A]">
                          {unit.description}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-[#6F6F6F]">
                    <span className="hidden sm:inline">{expanded ? "Hide outline" : "View outline"}</span>
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 text-[#111111]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[#6F6F6F]" />
                    )}
                  </span>
                </button>

                {expanded && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={headerId}
                    className="border-t border-[#EFEFEF] bg-[#FCFCFC] px-5 py-4 pl-16 text-[13px] leading-relaxed text-[#111111]"
                  >
                    <ChatMarkdown content={stripNotesLines(unit.content)} />

                    {renderMaterials(unit)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
