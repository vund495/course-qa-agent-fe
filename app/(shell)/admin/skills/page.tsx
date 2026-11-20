"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Layers,
  Plus,
  Search,
  Trash2,
  Edit2,
  ChevronLeft,
  X,
  Filter,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  skillApi,
  type SkillGroup,
  type Skill,
} from "@/lib/skill-api";
import {
  AdminPageShell,
  ADMIN_INPUT,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
} from "@/components/shared/AdminPageShell";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Modal } from "@/components/shared/Modal";
import { ViewSkillInfoModal } from "@/components/skills/ViewSkillInfoModal";

// Top accent bar color palette for domain cards
const CARD_ACCENTS = [
  "#2563EB", // blue-600
  "#0D9488", // teal-600
  "#7C3AED", // violet-600
  "#D97706", // amber-600
  "#059669", // emerald-600
  "#4F46E5", // indigo-600
];

function getCardAccent(index: number) {
  return CARD_ACCENTS[index % CARD_ACCENTS.length];
}

function AdminSkillsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupParam = searchParams.get("group");

  // Navigation & Hierarchy State
  const [groups, setGroups] = React.useState<SkillGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = React.useState<SkillGroup | null>(null);
  const [skills, setSkills] = React.useState<Skill[]>([]);

  // Loading States
  const [loadingGroups, setLoadingGroups] = React.useState(true);
  const [loadingSkills, setLoadingSkills] = React.useState(false);

  // Search States
  const [groupSearch, setGroupSearch] = React.useState("");
  const [skillSearch, setSkillSearch] = React.useState("");

  // View Skill Information Modal State
  const [selectedSkillForView, setSelectedSkillForView] = React.useState<Skill | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = React.useState(false);

  // Group Create & Edit Modal States
  const [isCreatingGroup, setIsCreatingGroup] = React.useState(false);
  const [newGroupCode, setNewGroupCode] = React.useState("");
  const [newGroupName, setNewGroupName] = React.useState("");
  const [newGroupDesc, setNewGroupDesc] = React.useState("");
  const [savingGroup, setSavingGroup] = React.useState(false);

  const [editingGroup, setEditingGroup] = React.useState<SkillGroup | null>(null);
  const [editGroupName, setEditGroupName] = React.useState("");
  const [editGroupDesc, setEditGroupDesc] = React.useState("");

  const [groupToDelete, setGroupToDelete] = React.useState<SkillGroup | null>(null);

  // Sub-Skill Create & Delete States
  const [isCreatingSkill, setIsCreatingSkill] = React.useState(false);
  const [newSkillName, setNewSkillName] = React.useState("");
  const [newSkillCode, setNewSkillCode] = React.useState("");
  const [newSkillDisplayId, setNewSkillDisplayId] = React.useState("");
  const [newSkillDomain, setNewSkillDomain] = React.useState("");
  const [newSkillSubDomain, setNewSkillSubDomain] = React.useState("");
  const [newSkillFamily, setNewSkillFamily] = React.useState("");
  const [newSkillClassification, setNewSkillClassification] = React.useState("");
  const [newSkillDesc, setNewSkillDesc] = React.useState("");
  const [savingSkill, setSavingSkill] = React.useState(false);

  const [skillToDelete, setSkillToDelete] = React.useState<Skill | null>(null);

  // Load Groups
  const fetchGroups = React.useCallback(async () => {
    try {
      setLoadingGroups(true);
      const data = await skillApi.listGroups();
      setGroups(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load skill groups");
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void fetchGroups();
  }, [fetchGroups]);

  // Load Sub-skills for selected group
  const fetchSubSkills = React.useCallback(async (groupId: string) => {
    try {
      setLoadingSkills(true);
      const data = await skillApi.listAdminSkills(groupId);
      setSkills(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load skills");
    } finally {
      setLoadingSkills(false);
    }
  }, []);

  // Handle Navigation between Grid and Sub-skills View
  const handleSelectGroup = React.useCallback(
    (group: SkillGroup) => {
      setSelectedGroup(group);
      router.push(`/admin/skills?group=${encodeURIComponent(group.code)}`);
    },
    [router]
  );

  const handleBackToGroups = React.useCallback(() => {
    setSelectedGroup(null);
    router.push("/admin/skills");
  }, [router]);

  // Sync selectedGroup with URL ?group= query parameter
  // This enables native browser Back & Forward navigation without leaving the Skill Taxonomy tab
  React.useEffect(() => {
    if (!loadingGroups && groups.length > 0) {
      if (groupParam) {
        const found = groups.find(
          (g) =>
            g.code.toUpperCase() === groupParam.toUpperCase() ||
            g.id === groupParam
        );
        if (found) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- sync URL state
          setSelectedGroup(found);
        } else {
          setSelectedGroup(null);
        }
      } else {
        setSelectedGroup(null);
      }
    }
  }, [groupParam, groups, loadingGroups]);

  React.useEffect(() => {
    if (selectedGroup) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on group change
      void fetchSubSkills(selectedGroup.id);
    } else {
      setSkills([]);
    }
  }, [selectedGroup, fetchSubSkills]);

  // Handle Refreshing after rubric edit
  const reloadSubSkills = () => {
    if (selectedGroup) {
      void fetchSubSkills(selectedGroup.id);
    }
  };

  // Group Handlers
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupCode.trim() || !newGroupName.trim()) {
      toast.error("Group code and name are required");
      return;
    }
    try {
      setSavingGroup(true);
      await skillApi.createGroup({
        code: newGroupCode.trim().toUpperCase(),
        name: newGroupName.trim(),
        description: newGroupDesc.trim() || undefined,
      });
      toast.success("Skill group created successfully");
      setIsCreatingGroup(false);
      setNewGroupCode("");
      setNewGroupName("");
      setNewGroupDesc("");
      await fetchGroups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setSavingGroup(false);
    }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup || !editGroupName.trim()) return;
    try {
      setSavingGroup(true);
      await skillApi.updateGroup(editingGroup.id, {
        name: editGroupName.trim(),
        description: editGroupDesc.trim() || undefined,
      });
      toast.success("Skill group updated");
      setEditingGroup(null);
      await fetchGroups();
      if (selectedGroup?.id === editingGroup.id) {
        setSelectedGroup((prev) =>
          prev ? { ...prev, name: editGroupName.trim(), description: editGroupDesc.trim() } : null
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update group");
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    try {
      await skillApi.deleteGroup(groupToDelete.id);
      toast.success("Skill group deleted");
      if (selectedGroup?.id === groupToDelete.id) {
        handleBackToGroups();
      }
      setGroupToDelete(null);
      await fetchGroups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete group");
    }
  };

  // Skill Handlers
  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim() || !newSkillCode.trim()) {
      toast.error("Skill name and code are required");
      return;
    }
    try {
      setSavingSkill(true);
      await skillApi.createAdminSkill({
        name: newSkillName.trim(),
        code: newSkillCode.trim().toUpperCase(),
        display_id: newSkillDisplayId.trim() || undefined,
        group_id: selectedGroup?.id ?? null,
        domain: newSkillDomain.trim() || undefined,
        sub_domain: newSkillSubDomain.trim() || undefined,
        skill_family: newSkillFamily.trim() || undefined,
        classification: newSkillClassification.trim() || undefined,
        description: newSkillDesc.trim() || undefined,
      });
      toast.success("Skill created successfully");
      setIsCreatingSkill(false);
      setNewSkillName("");
      setNewSkillCode("");
      setNewSkillDisplayId("");
      setNewSkillDesc("");
      if (selectedGroup) {
        await fetchSubSkills(selectedGroup.id);
      }
      await fetchGroups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create skill");
    } finally {
      setSavingSkill(false);
    }
  };

  const handleDeleteSkill = async () => {
    if (!skillToDelete) return;
    try {
      await skillApi.deleteAdminSkill(skillToDelete.id);
      toast.success("Skill deleted");
      setSkillToDelete(null);
      if (selectedGroup) {
        await fetchSubSkills(selectedGroup.id);
      }
      await fetchGroups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete skill");
    }
  };

  // Filtered Groups
  const filteredGroups = groups.filter((g) => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return true;
    return g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q);
  });

  // Filtered & Numerically Sorted Sub-skills
  const filteredSkills = React.useMemo(() => {
    const list = skills.filter((s) => {
      const q = skillSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.display_id && s.display_id.toLowerCase().includes(q)) ||
        (s.domain && s.domain.toLowerCase().includes(q)) ||
        (s.sub_domain && s.sub_domain.toLowerCase().includes(q)) ||
        (s.skill_family && s.skill_family.toLowerCase().includes(q)) ||
        (s.classification && s.classification.toLowerCase().includes(q))
      );
    });
    return list.sort((a, b) => {
      const numA = parseInt(a.display_id || "0", 10);
      const numB = parseInt(b.display_id || "0", 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numA - numB;
      }
      return (a.display_id || "").localeCompare(b.display_id || "");
    });
  }, [skills, skillSearch]);

  return (
    <AdminPageShell
      title="Skill Taxonomy Catalog"
      subtitle="Organize standard skill domains, competencies, and evaluation rubrics."
      actions={
        !selectedGroup ? (
          <button
            type="button"
            onClick={() => {
              setNewGroupCode("");
              setNewGroupName("");
              setNewGroupDesc("");
              setIsCreatingGroup(true);
            }}
            className={ADMIN_BTN_PRIMARY}
          >
            <Plus className="w-4 h-4" />
            Add Skill Group
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBackToGroups}
              className={ADMIN_BTN_SECONDARY}
            >
              <ChevronLeft className="w-4 h-4" />
              All Groups
            </button>
            <button
              type="button"
              onClick={() => {
                setNewSkillName("");
                setNewSkillCode("");
                setNewSkillDisplayId("");
                setNewSkillDesc("");
                setIsCreatingSkill(true);
              }}
              className={ADMIN_BTN_PRIMARY}
            >
              <Plus className="w-4 h-4" />
              Add Skill
            </button>
          </div>
        )
      }
    >
      {/* =========================================================================
          VIEW 1: SKILL GROUPS GRID OVERVIEW
          ========================================================================= */}
      {!selectedGroup ? (
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search skill domains..."
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                className={ADMIN_INPUT + " pl-9 pr-8"}
              />
              {groupSearch && (
                <button
                  type="button"
                  onClick={() => setGroupSearch("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Groups Grid */}
          {loadingGroups ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              Loading skill domains...
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900 mb-1">
                No skill groups found
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                {groupSearch
                  ? "Try adjusting your search criteria"
                  : "Create your first skill group to start building the taxonomy"}
              </p>
              {!groupSearch && (
                <button
                  type="button"
                  onClick={() => setIsCreatingGroup(true)}
                  className={ADMIN_BTN_PRIMARY + " mx-auto"}
                >
                  <Plus className="w-4 h-4" />
                  Add Skill Group
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredGroups.map((group, index) => (
                <div
                  key={group.id}
                  onClick={() => handleSelectGroup(group)}
                  className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md group"
                >
                  {/* Accent Top Bar */}
                  <div
                    className="h-2 w-full transition-colors"
                    style={{ backgroundColor: getCardAccent(index) }}
                  />

                  <div className="p-4 flex-1 flex flex-col">
                    {/* Header: Title on Top Left + Actions on Top Right */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-[15px] font-heading font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors">
                        {group.name}
                      </h3>
                      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingGroup(group);
                            setEditGroupName(group.name);
                            setEditGroupDesc(group.description || "");
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                          title="Edit Group"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGroupToDelete(group);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Delete Group"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-500 line-clamp-2 mb-4 flex-1 leading-relaxed">
                      {group.description || "No description provided for this skill domain."}
                    </p>

                    {/* Footer Info: Skill Count Badge */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs text-slate-500 font-medium mt-auto">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        <span>{group.skills_count} Sub-skills</span>
                      </div>
                      <span className="text-blue-600 font-semibold text-xs group-hover:translate-x-0.5 transition-transform">
                        Explore &rarr;
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* =========================================================================
            VIEW 2: SUB-SKILLS TABLE VIEW (SCOPED TO SELECTED GROUP)
            ========================================================================= */
        <div className="space-y-5">
          {/* Breadcrumb & Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBackToGroups}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-xs transition-colors hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Skill Groups
              </button>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-0.5">
                  <button
                    type="button"
                    onClick={handleBackToGroups}
                    className="hover:text-blue-600 transition-colors font-medium hover:underline"
                  >
                    Skill Taxonomy
                  </button>
                  <span>/</span>
                  <span className="text-slate-800 font-semibold">{selectedGroup.name}</span>
                </div>
                <h2 className="text-lg font-heading font-bold text-slate-900">
                  {selectedGroup.name}
                </h2>
                {selectedGroup.description && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedGroup.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search sub-skills..."
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
                className={ADMIN_INPUT + " pl-9 pr-8 text-xs"}
              />
              {skillSearch && (
                <button
                  type="button"
                  onClick={() => setSkillSearch("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              Filter
            </button>
          </div>

          {/* Sub-Skills Table (Exact 6-column clean layout) */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            {loadingSkills ? (
              <div className="p-12 text-center text-slate-500 flex items-center justify-center gap-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                Loading sub-skills...
              </div>
            ) : filteredSkills.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-xs text-slate-500 mb-3">
                  {skillSearch
                    ? "No skills matching your search query"
                    : "No sub-skills added to this domain yet."}
                </p>
                {!skillSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewSkillName("");
                      setNewSkillCode("");
                      setNewSkillDisplayId("");
                      setNewSkillDesc("");
                      setIsCreatingSkill(true);
                    }}
                    className={ADMIN_BTN_PRIMARY + " mx-auto text-xs"}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add First Skill
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-white border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-3.5 px-4 w-20">ID</th>
                    <th className="py-3.5 px-4">Domain</th>
                    <th className="py-3.5 px-4">Sub-domain</th>
                    <th className="py-3.5 px-4">Skill Family</th>
                    <th className="py-3.5 px-4">Skill Name</th>
                    <th className="py-3.5 px-4 pr-6">Skill Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSkills.map((skill, index) => {
                    const displayId = skill.display_id || String(index + 1);
                    return (
                      <tr
                        key={skill.id}
                        onClick={() => {
                          setSelectedSkillForView(skill);
                          setIsViewModalOpen(true);
                        }}
                        className="hover:bg-slate-50 cursor-pointer transition-colors group"
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {displayId}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {skill.domain || "—"}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {skill.sub_domain || "—"}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {skill.skill_family || "—"}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {skill.name}
                        </td>
                        <td className="py-3.5 px-4 pr-6">
                          {skill.classification === "Tool" ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80">
                              Tool
                            </span>
                          ) : skill.classification === "Functional Skill" ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                              Functional Skill
                            </span>
                          ) : skill.classification ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-medium bg-blue-50 text-blue-800 border border-blue-200/80">
                              {skill.classification}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: "VIEW SKILL INFORMATION" POPUP MODAL (3 TABS)
          ========================================================================= */}
      <ViewSkillInfoModal
        skill={selectedSkillForView}
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        canEditRubric={true}
        onRubricUpdated={reloadSubSkills}
        onDeleteSkill={(skill) => setSkillToDelete(skill)}
      />

      {/* =========================================================================
          MODALS: CREATE SKILL GROUP
          ========================================================================= */}
      <Modal
        isOpen={isCreatingGroup}
        onClose={() => setIsCreatingGroup(false)}
        title="Add Skill Group"
        subtitle="Create a top-level taxonomy domain (e.g., Python Ecosystem, SQL Database)."
      >
        <form onSubmit={handleCreateGroup} className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Group Code *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. PYTHON, DATABASE, AI_ML"
              value={newGroupCode}
              onChange={(e) => setNewGroupCode(e.target.value)}
              className={ADMIN_INPUT}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Group Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Python Ecosystem & Frameworks"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className={ADMIN_INPUT}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Describe the scope of this skill group..."
              value={newGroupDesc}
              onChange={(e) => setNewGroupDesc(e.target.value)}
              className={ADMIN_INPUT}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreatingGroup(false)}
              className={ADMIN_BTN_SECONDARY}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingGroup}
              className={ADMIN_BTN_PRIMARY}
            >
              {savingGroup && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Group
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODALS: EDIT SKILL GROUP
          ========================================================================= */}
      <Modal
        isOpen={!!editingGroup}
        onClose={() => setEditingGroup(null)}
        title="Edit Skill Group"
        subtitle={editingGroup ? `Updating group: ${editingGroup.code}` : ""}
      >
        <form onSubmit={handleUpdateGroup} className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Group Name *
            </label>
            <input
              type="text"
              required
              value={editGroupName}
              onChange={(e) => setEditGroupName(e.target.value)}
              className={ADMIN_INPUT}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Description
            </label>
            <textarea
              rows={3}
              value={editGroupDesc}
              onChange={(e) => setEditGroupDesc(e.target.value)}
              className={ADMIN_INPUT}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingGroup(null)}
              className={ADMIN_BTN_SECONDARY}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingGroup}
              className={ADMIN_BTN_PRIMARY}
            >
              {savingGroup && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODALS: CREATE SUB-SKILL
          ========================================================================= */}
      <Modal
        isOpen={isCreatingSkill}
        onClose={() => setIsCreatingSkill(false)}
        title="Add Sub-Skill"
        subtitle={selectedGroup ? `Adding to domain: ${selectedGroup.name}` : ""}
        widthClass="max-w-lg"
      >
        <form onSubmit={handleCreateSkill} className="space-y-3.5 pt-2 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 mb-1 block">
                Skill Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Object-Oriented Programming"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                className={ADMIN_INPUT}
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 mb-1 block">
                Unique Skill Code *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. OOP_JAVA, PY_PANDAS"
                value={newSkillCode}
                onChange={(e) => setNewSkillCode(e.target.value)}
                className={ADMIN_INPUT}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 mb-1 block">
                Display ID (Optional)
              </label>
              <input
                type="text"
                placeholder="Leave blank to auto-generate (e.g. 1, 2, ...)"
                value={newSkillDisplayId}
                onChange={(e) => setNewSkillDisplayId(e.target.value)}
                className={ADMIN_INPUT}
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 mb-1 block">
                Classification
              </label>
              <select
                value={newSkillClassification}
                onChange={(e) => setNewSkillClassification(e.target.value)}
                className={ADMIN_INPUT}
              >
                <option value="">Select classification...</option>
                <option value="Technical Skill">Technical Skill</option>
                <option value="Tool">Tool</option>
                <option value="Functional Skill">Functional Skill</option>
                <option value="Soft Skill">Soft Skill</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 mb-1 block">
                Domain
              </label>
              <input
                type="text"
                value={newSkillDomain}
                onChange={(e) => setNewSkillDomain(e.target.value)}
                className={ADMIN_INPUT}
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 mb-1 block">
                Sub-domain
              </label>
              <input
                type="text"
                value={newSkillSubDomain}
                onChange={(e) => setNewSkillSubDomain(e.target.value)}
                className={ADMIN_INPUT}
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 mb-1 block">
                Skill Family
              </label>
              <input
                type="text"
                value={newSkillFamily}
                onChange={(e) => setNewSkillFamily(e.target.value)}
                className={ADMIN_INPUT}
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 mb-1 block">
              Skill Description
            </label>
            <textarea
              rows={3}
              placeholder="Detailed description of what this competency involves..."
              value={newSkillDesc}
              onChange={(e) => setNewSkillDesc(e.target.value)}
              className={ADMIN_INPUT}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreatingSkill(false)}
              className={ADMIN_BTN_SECONDARY}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingSkill}
              className={ADMIN_BTN_PRIMARY}
            >
              {savingSkill && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Skill
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          CONFIRM DIALOGS
          ========================================================================= */}
      <ConfirmDialog
        isOpen={!!groupToDelete}
        title="Delete Skill Group"
        description={
          groupToDelete
            ? `Are you sure you want to delete "${groupToDelete.name}" (${groupToDelete.code})? All sub-skills inside this group will also be permanently deleted.`
            : ""
        }
        confirmLabel="Delete Group"
        tone="danger"
        onConfirm={handleDeleteGroup}
        onCancel={() => setGroupToDelete(null)}
      />

      <ConfirmDialog
        isOpen={!!skillToDelete}
        title="Delete Skill"
        description={
          skillToDelete
            ? `Are you sure you want to delete "${skillToDelete.name}" (${skillToDelete.code})? This will remove its evaluation rubrics and class associations.`
            : ""
        }
        confirmLabel="Delete Skill"
        tone="danger"
        onConfirm={handleDeleteSkill}
        onCancel={() => setSkillToDelete(null)}
      />
    </AdminPageShell>
  );
}

export default function AdminSkillsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-12 text-center text-slate-500 flex items-center justify-center gap-2 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          Loading taxonomy...
        </div>
      }
    >
      <AdminSkillsContent />
    </React.Suspense>
  );
}
