"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Skill, SkillLevel, skillApi } from "@/lib/skill-api";
import {
  Layers,
  Sparkles,
  Award,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Plus,
  Save,
  HelpCircle,
} from "lucide-react";
import { Reveal, SkeletonCard, SkeletonLine } from "@/components/shared/page-skeleton";
import { ClassPageHeader } from "@/components/shared/ClassPageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const PROFICIENCY_LEVELS: {
  level: SkillLevel;
  name: string;
  badgeClass: string;
  defaultThreshold: number;
}[] = [
  {
    level: "NOVICE",
    name: "Novice",
    badgeClass: "bg-muted text-foreground border-border",
    defaultThreshold: 80,
  },
  {
    level: "BEGINNER",
    name: "Beginner",
    badgeClass: "bg-[var(--brand-soft)] text-[var(--brand-ink)] border-[var(--brand-line)]",
    defaultThreshold: 75,
  },
  {
    level: "COMPETENT",
    name: "Competent",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    defaultThreshold: 70,
  },
  {
    level: "PROFICIENT",
    name: "Proficient",
    badgeClass: "bg-muted text-foreground border-border",
    defaultThreshold: 65,
  },
  {
    level: "MASTER",
    name: "Master",
    badgeClass: "bg-muted text-foreground border-border",
    defaultThreshold: 60,
  },
];

export default function TeacherClassSkillsPage() {
  const params = useParams();
  const classId = params.id as string;

  const [skills, setSkills] = React.useState<Skill[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedSkillId, setSelectedSkillId] = React.useState<string | null>(null);
  const [expandedLevels, setExpandedLevels] = React.useState<Record<string, boolean>>({
    NOVICE: true,
    BEGINNER: true,
    COMPETENT: true,
    PROFICIENT: true,
    MASTER: true,
  });

  // Edit / draft states for rubric descriptions & thresholds
  const [rubricDrafts, setRubricDrafts] = React.useState<
    Record<string, { description: string; threshold_pct: number }>
  >({});
  const [savingLevel, setSavingLevel] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState<string | null>(null);

  // New Skill Modal
  const [isCreatingSkill, setIsCreatingSkill] = React.useState(false);
  const [newSkillCode, setNewSkillCode] = React.useState("");
  const [newSkillName, setNewSkillName] = React.useState("");
  const [newSkillCategory, setNewSkillCategory] = React.useState("PYTHON");
  const [newSkillDesc, setNewSkillDesc] = React.useState("");
  const [createLoading, setCreateLoading] = React.useState(false);

  // Auto-generation State
  const [generatingSkills, setGeneratingSkills] = React.useState(false);
  const [isConfirmingGenerate, setIsConfirmingGenerate] = React.useState(false);

  const handleAutoGenerateSkills = async () => {
    if (!classId) return;
    setIsConfirmingGenerate(false);

    try {
      setGeneratingSkills(true);
      setError(null);
      const generated = await skillApi.autoGenerateSkills(classId);
      setSkills(generated);
      if (generated.length > 0) {
        setSelectedSkillId(generated[0].id);
      }
      setSaveSuccess(`Successfully generated ${generated.length} skills with rubrics!`);
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate skills.");
    } finally {
      setGeneratingSkills(false);
    }
  };

  const fetchSkills = React.useCallback(async () => {
    if (!classId) return;
    try {
      setError(null);
      const data = await skillApi.listClassSkills(classId);
      setSkills(data);
      setSelectedSkillId((prev) => prev ?? data[0]?.id ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load skills.");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time fetch; state is only set after the await.
    void fetchSkills();
  }, [fetchSkills]);

  const selectedSkill = React.useMemo(() => {
    return skills.find((s) => s.id === selectedSkillId) || skills[0] || null;
  }, [skills, selectedSkillId]);

  // Sync drafts when selected skill changes
  const activeDrafts = React.useMemo(() => {
    if (!selectedSkill) return {};
    const drafts: Record<string, { description: string; threshold_pct: number }> = {};
    for (const p of PROFICIENCY_LEVELS) {
      const existing = selectedSkill.rubrics?.find((r) => r.level === p.level);
      drafts[p.level] = {
        description: existing?.description || "",
        threshold_pct: existing?.threshold_pct || p.defaultThreshold,
      };
    }
    return drafts;
  }, [selectedSkill]);

  const currentRubricDrafts = { ...activeDrafts, ...rubricDrafts };

  const handleRubricChange = (
    level: SkillLevel,
    field: "description" | "threshold_pct",
    val: string | number
  ) => {
    setRubricDrafts((prev) => ({
      ...prev,
      [level]: {
        description:
          field === "description"
            ? (val as string)
            : prev[level]?.description ?? activeDrafts[level]?.description ?? "",
        threshold_pct:
          field === "threshold_pct"
            ? (val as number)
            : prev[level]?.threshold_pct ?? activeDrafts[level]?.threshold_pct ?? 70,
      },
    }));
  };

  const handleSaveRubric = async (level: SkillLevel) => {
    if (!selectedSkill || !classId) return;
    const draft = currentRubricDrafts[level];
    if (!draft || !draft.description.trim()) {
      toast.error("Please provide the evaluation scope description for this level.");
      return;
    }

    try {
      setSavingLevel(level);
      await skillApi.updateClassRubric(classId, selectedSkill.id, level, {
        description: draft.description.trim(),
        threshold_pct: draft.threshold_pct,
      });
      setSaveSuccess(`Saved rubric for ${level}!`);
      setTimeout(() => setSaveSuccess(null), 3000);
      await fetchSkills();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save rubric.");
    } finally {
      setSavingLevel(null);
    }
  };

  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillCode.trim() || !newSkillName.trim()) {
      toast.error("Skill code and name are required.");
      return;
    }

    try {
      setCreateLoading(true);
      const created = await skillApi.createClassSkill(classId, {
        code: newSkillCode.trim(),
        name: newSkillName.trim(),
        category: newSkillCategory.trim() || "GENERAL",
        description: newSkillDesc.trim() || undefined,
        rubrics: PROFICIENCY_LEVELS.map((p) => ({
          level: p.level,
          description: `Assessment of ${p.name} level understanding for ${newSkillName.trim()}`,
          threshold_pct: p.defaultThreshold,
        })),
      });
      setIsCreatingSkill(false);
      setNewSkillCode("");
      setNewSkillName("");
      setNewSkillDesc("");
      await fetchSkills();
      setSelectedSkillId(created.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create skill.");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <ClassPageHeader
        title="Skills & Evaluation Rubrics"
        subtitle="Define the skills tested in your quizzes and what each of the 5 mastery levels expects, from Novice to Master."
        badge={
          <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-[#E5EFF8]">
            Class Scoped
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="brand"
              onClick={() => setIsConfirmingGenerate(true)}
              disabled={generatingSkills}
              className="h-9 gap-1.5 px-3.5"
            >
              <Sparkles className={`h-4 w-4 ${generatingSkills ? "animate-spin" : ""}`} />
              {generatingSkills ? "Synthesizing Rubrics..." : "Auto-generate Skills"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreatingSkill(true)}
              className="h-9 gap-1.5 border-white/25 bg-transparent px-3.5 text-white hover:bg-white/10 hover:text-white"
            >
              <Plus className="h-4 w-4" />
              Add Skill
            </Button>
          </div>
        }
      />

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Main Content Layout — both columns stretch to the same height so an
          empty right panel never leaves the left card short. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Skill Navigation */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-border shadow-xs p-4 flex flex-col min-h-[420px]">
          <div className="flex items-center justify-between pb-3 border-b border-hairline mb-3">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-muted-foreground" />
              Course Skills ({skills.length})
            </h2>
          </div>

          {loading ? (
            <div className="space-y-2" aria-hidden>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <SkeletonLine className="h-4 w-16" />
                  <SkeletonLine className="mt-2 h-4 w-3/4" />
                  <SkeletonLine className="mt-1.5 h-3 w-full" />
                </div>
              ))}
            </div>
          ) : skills.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-2 py-8 text-center">
              <EmptyState
                icon={Layers}
                title="No skills defined for this course yet."
                description="Generate a 5-level rubric from the course description, or add a skill by hand."
                className="border-0 px-0 py-0"
              />
              <div className="mt-4 flex w-full flex-col gap-2">
                <Button
                  type="button"
                  variant="brand"
                  onClick={() => setIsConfirmingGenerate(true)}
                  disabled={generatingSkills}
                  size="sm"
                  className="w-full"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${generatingSkills ? "animate-spin" : ""}`} />
                  {generatingSkills ? "Synthesizing..." : "Auto-generate 5-Level Rubrics"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreatingSkill(true)}
                  className="w-full"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create manually
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {skills.map((s) => {
                const isSelected = selectedSkill?.id === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSkillId(s.id)}
                    className={`w-full text-left p-3 rounded-lg border transition ${
                      isSelected
                        ? "bg-[var(--brand-soft)] border-[var(--brand-line)] text-[var(--brand-ink)] font-medium shadow-xs"
                        : "bg-white border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-muted text-foreground">
                        {s.code}
                      </span>
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                        {s.category}
                      </span>
                    </div>
                    <div className="text-sm font-semibold mt-1.5 line-clamp-1">{s.name}</div>
                    {s.description && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{s.description}</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Skill Detail & 5-Level Rubrics */}
        <div className="lg:col-span-8 flex flex-col min-h-[420px]">
          {loading ? (
            <SkeletonCard className="h-full min-h-[420px]" />
          ) : selectedSkill ? (
            <Reveal className="space-y-6">
              {/* Skill Header */}
              <div className="bg-white rounded-xl border border-border shadow-xs p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-muted text-foreground border border-border">
                      {selectedSkill.code}
                    </span>
                    <h2 className="text-xl font-bold text-foreground">{selectedSkill.name}</h2>
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-muted text-muted-foreground">
                    Category: {selectedSkill.category}
                  </span>
                </div>
                {selectedSkill.description && (
                  <p className="text-sm text-muted-foreground mt-3">{selectedSkill.description}</p>
                )}
              </div>

              {saveSuccess && (
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  {saveSuccess}
                </div>
              )}

              {/* 5-Level Rubric Accordions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Award className="w-4 h-4 text-[var(--brand)]" />
                    Proficiency Rubrics (Novice to Master)
                  </h3>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" />
                    Threshold: % correct required to pass level gate
                  </div>
                </div>

                {PROFICIENCY_LEVELS.map((p) => {
                  const isExpanded = expandedLevels[p.level] ?? true;
                  const draft = currentRubricDrafts[p.level] || {
                    description: "",
                    threshold_pct: p.defaultThreshold,
                  };
                  const isSaving = savingLevel === p.level;

                  return (
                    <div
                      key={p.level}
                      className="bg-white rounded-xl border border-border shadow-xs overflow-hidden"
                    >
                      {/* Accordion Header */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedLevels((prev) => ({
                            ...prev,
                            [p.level]: !prev[p.level],
                          }))
                        }
                        className="w-full px-5 py-4 flex items-center justify-between bg-muted/50 hover:bg-muted transition border-b border-hairline"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2.5 py-1 rounded text-xs font-bold border ${p.badgeClass}`}
                          >
                            {p.level}
                          </span>
                          <span className="text-sm font-semibold text-foreground">{p.name} Level</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-medium text-muted-foreground">
                            Passing: <strong className="text-foreground">{draft.threshold_pct}%</strong>
                          </span>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {/* Accordion Content */}
                      {isExpanded && (
                        <div className="p-5 space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                              Tested Understanding / Evaluation Scope
                            </label>
                            <p className="text-xs text-muted-foreground mb-2">
                              Describe what knowledge depth or comprehension level is tested for this
                              skill at the {p.name} level.
                            </p>
                            <textarea
                              rows={3}
                              value={draft.description}
                              onChange={(e) =>
                                handleRubricChange(p.level, "description", e.target.value)
                              }
                              placeholder={`e.g. Can recognize and explain basic syntax, keywords, and simple rules of ${selectedSkill.name}.`}
                              className="w-full text-sm rounded-lg border border-input p-3 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30 focus:border-[var(--brand)] bg-white"
                            />
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-hairline">
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-semibold text-muted-foreground">
                                Pass Threshold:
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={draft.threshold_pct}
                                onChange={(e) =>
                                  handleRubricChange(
                                    p.level,
                                    "threshold_pct",
                                    parseInt(e.target.value, 10) || 70
                                  )
                                }
                                className="w-20 text-sm font-semibold text-center rounded border border-input py-1 px-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>

                            <Button
                              type="button"
                              variant="brand"
                              size="sm"
                              disabled={isSaving}
                              onClick={() => handleSaveRubric(p.level)}
                            >
                              <Save className="w-3.5 h-3.5" />
                              {isSaving ? "Saving..." : `Save ${p.name} Rubric`}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Reveal>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-white p-12 text-center text-sm text-muted-foreground">
              Select or create a skill to view and configure its rubrics.
            </div>
          )}
        </div>
      </div>

      {/* New Skill Modal */}
      {isCreatingSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-lg font-bold text-foreground mb-1">Add Course Skill</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Add a skill domain tailored for your course syllabus and quiz evaluation.
            </p>

            <form onSubmit={handleCreateSkill} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1">
                  Skill Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PY-CONTROL-FLOW"
                  value={newSkillCode}
                  onChange={(e) => setNewSkillCode(e.target.value.toUpperCase())}
                  className="w-full text-sm rounded-lg border border-input px-3 py-2 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30 focus:border-[var(--brand)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1">
                  Skill Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Python Control Flow & Loops"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  className="w-full text-sm rounded-lg border border-input px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30 focus:border-[var(--brand)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1">
                  Category
                </label>
                <input
                  type="text"
                  placeholder="e.g. PYTHON"
                  value={newSkillCategory}
                  onChange={(e) => setNewSkillCategory(e.target.value.toUpperCase())}
                  className="w-full text-sm rounded-lg border border-input px-3 py-2 uppercase focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30 focus:border-[var(--brand)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional brief description of what this skill covers..."
                  value={newSkillDesc}
                  onChange={(e) => setNewSkillDesc(e.target.value)}
                  className="w-full text-sm rounded-lg border border-input px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30 focus:border-[var(--brand)]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-hairline">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsCreatingSkill(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="brand" disabled={createLoading}>
                  {createLoading ? "Creating..." : "Create Skill"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Dialog open={isConfirmingGenerate} onOpenChange={setIsConfirmingGenerate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate skills and rubrics</DialogTitle>
            <DialogDescription>
              Synthesize a 5-level skill taxonomy and rubrics from this course&apos;s description and
              metadata? Existing skills stay as they are; the generated ones are added alongside them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setIsConfirmingGenerate(false)}>
              Cancel
            </Button>
            <Button type="button" variant="brand" onClick={() => void handleAutoGenerateSkills()}>
              <Sparkles className="w-4 h-4" />
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
