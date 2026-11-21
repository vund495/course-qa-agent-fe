"use client";

import * as React from "react";
import {
  type Skill,
  type SkillLevel,
  type SkillLevelRubric,
  skillApi,
} from "@/lib/skill-api";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Edit2, Loader2, Save, Trash2 } from "lucide-react";

interface ViewSkillInfoModalProps {
  skill: Skill | null;
  isOpen: boolean;
  onClose: () => void;
  canEditRubric?: boolean;
  onRubricUpdated?: () => void;
  onDeleteSkill?: (skill: Skill) => void;
}

const RUBRIC_LEVEL_MAP: Record<
  SkillLevel,
  { number: number; label: string }
> = {
  NOVICE: { number: 0, label: "No Experience" },
  BEGINNER: { number: 1, label: "Basic" },
  COMPETENT: { number: 2, label: "Intermediate" },
  PROFICIENT: { number: 3, label: "Advanced" },
  MASTER: { number: 4, label: "Expert" },
};

const ORDERED_LEVELS: SkillLevel[] = [
  "NOVICE",
  "BEGINNER",
  "COMPETENT",
  "PROFICIENT",
  "MASTER",
];

export function ViewSkillInfoModal({
  skill,
  isOpen,
  onClose,
  canEditRubric = false,
  onRubricUpdated,
  onDeleteSkill,
}: ViewSkillInfoModalProps) {
  const [activeTab, setActiveTab] = React.useState<"info" | "rubric" | "courses">("info");

  // Editing state for rubrics
  const [editingLevel, setEditingLevel] = React.useState<SkillLevel | null>(null);
  const [draftDesc, setDraftDesc] = React.useState("");
  const [savingRubric, setSavingRubric] = React.useState(false);

  // Reset tab when opening a new skill
  React.useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset modal state on open
      setActiveTab("info");
      setEditingLevel(null);
    }
  }, [isOpen, skill?.id]);

  if (!skill) return null;

  const startEditRubric = (rubric: SkillLevelRubric) => {
    setEditingLevel(rubric.level);
    setDraftDesc(rubric.description);
  };

  const handleSaveRubric = async () => {
    if (!editingLevel || !skill) return;
    try {
      setSavingRubric(true);
      await skillApi.updateAdminRubric(skill.id, editingLevel, {
        description: draftDesc.trim(),
      });
      toast.success("Rubric updated successfully");
      setEditingLevel(null);
      if (onRubricUpdated) onRubricUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update rubric");
    } finally {
      setSavingRubric(false);
    }
  };

  // Group rubrics by level
  const rubricMap = new Map<SkillLevel, SkillLevelRubric>();
  skill.rubrics?.forEach((r) => rubricMap.set(r.level, r));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden sm:max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-2 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-4 pr-8">
            <DialogTitle className="text-xl font-heading font-bold text-slate-900">
              View Skill Information
            </DialogTitle>
            {onDeleteSkill && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onDeleteSkill(skill);
                }}
                className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 text-xs h-7 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Skill</span>
              </Button>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-8 -mb-px text-sm">
            <button
              type="button"
              onClick={() => setActiveTab("info")}
              className={`pb-3 font-medium transition-colors border-b-2 ${
                activeTab === "info"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Skill information
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("rubric")}
              className={`pb-3 font-medium transition-colors border-b-2 ${
                activeTab === "rubric"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Skill Rubric
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("courses")}
              className={`pb-3 font-medium transition-colors border-b-2 ${
                activeTab === "courses"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Courses
              {skill.courses && skill.courses.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                  {skill.courses.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          {/* TAB 1: Skill Information */}
          {activeTab === "info" && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
                <div className="mb-4 pb-3 border-b border-slate-100">
                  <h3 className="text-lg font-heading font-bold text-slate-900">
                    {skill.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Detailed Specification & Competency Description
                  </p>
                </div>

                <div className="text-[13.5px] text-slate-700 leading-relaxed whitespace-pre-line text-justify">
                  {skill.description || "No detailed description provided for this skill."}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Skill Rubric */}
          {activeTab === "rubric" && (
            <div className="space-y-3">
              {ORDERED_LEVELS.map((level) => {
                const info = RUBRIC_LEVEL_MAP[level];
                const rubric = rubricMap.get(level);
                const isEditing = editingLevel === level;

                return (
                  <div
                    key={level}
                    className="bg-white rounded-lg border border-slate-200 p-4 transition-all shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 font-semibold text-xs flex items-center justify-center border border-blue-200">
                          {info.number}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-900">
                          {info.label}
                        </h4>
                      </div>

                      {canEditRubric && rubric && !isEditing && (
                        <button
                          type="button"
                          onClick={() => startEditRubric(rubric)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-600 mb-1 block">
                            Rubric Criteria Description
                          </label>
                          <textarea
                            rows={5}
                            value={draftDesc}
                            onChange={(e) => setDraftDesc(e.target.value)}
                            className="w-full text-xs p-2.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white leading-relaxed"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingLevel(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={savingRubric}
                            onClick={handleSaveRubric}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
                          >
                            {savingRubric ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Save className="w-3 h-3" />
                            )}
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-line text-justify">
                        {rubric?.description ||
                          "No specific criteria described for this proficiency level."}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: Courses */}
          {activeTab === "courses" && (
            <div className="space-y-4">
              {!skill.courses || skill.courses.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                  <p className="text-sm text-slate-500">
                    No classes or courses are currently integrating this skill.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-3 px-4">Class Code</th>
                        <th className="py-3 px-4">Class Name</th>
                        <th className="py-3 px-4">Trainer</th>
                        <th className="py-3 px-4">Semester</th>
                        <th className="py-3 px-4">Assigned Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {skill.courses.map((course) => (
                        <tr key={course.class_id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {course.class_code}
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-medium">
                            {course.class_name}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {course.trainer_name || "—"}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {course.semester || "—"} {course.academic_year || ""}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {course.assigned_at
                              ? new Date(course.assigned_at).toLocaleDateString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
