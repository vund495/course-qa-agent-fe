"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  Skill,
  SkillTreeGroup,
  skillApi,
} from "@/lib/skill-api";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  X,
  Filter,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { ClassPageHeader } from "@/components/shared/ClassPageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ViewSkillInfoModal } from "@/components/skills/ViewSkillInfoModal";

export default function TeacherClassSkillsPage() {
  const params = useParams();
  const classId = params.id as string;

  // Class Assigned Skills State
  const [skills, setSkills] = React.useState<Skill[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Search & Filter on Main Table
  const [search, setSearch] = React.useState("");
  const [selectedDomainFilter, setSelectedDomainFilter] = React.useState<string>("ALL");

  // Full Skill Information Modal State
  const [modalSkill, setModalSkill] = React.useState<Skill | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  // Add Skill Catalog Modal State
  const [isCatalogOpen, setIsCatalogOpen] = React.useState(false);
  const [catalogGroups, setCatalogGroups] = React.useState<SkillTreeGroup[]>([]);
  const [loadingCatalog, setLoadingCatalog] = React.useState(false);
  const [catalogSearch, setCatalogSearch] = React.useState("");
  const [expandedGroupIds, setExpandedGroupIds] = React.useState<Set<string>>(new Set());
  const [selectedCatalogIds, setSelectedCatalogIds] = React.useState<Set<string>>(new Set());
  const [assigningLoading, setAssigningLoading] = React.useState(false);

  // Unassign Confirm Dialog
  const [skillToUnassign, setSkillToUnassign] = React.useState<Skill | null>(null);
  const [unassigningLoading, setUnassigningLoading] = React.useState(false);

  // Load Class Skills
  const fetchClassSkills = React.useCallback(async () => {
    if (!classId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await skillApi.listClassSkills(classId);
      setSkills(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load class skills.");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time fetch
    void fetchClassSkills();
  }, [fetchClassSkills]);

  // Open Catalog Modal & Fetch Global Taxonomy
  const handleOpenCatalog = async () => {
    setIsCatalogOpen(true);
    setSelectedCatalogIds(new Set());
    setCatalogSearch("");
    setExpandedGroupIds(new Set()); // Keep all topics collapsed initially as requested
    try {
      setLoadingCatalog(true);
      const tree = await skillApi.getCatalogTree();
      setCatalogGroups(tree);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load skills catalog.");
    } finally {
      setLoadingCatalog(false);
    }
  };

  // Toggle Dropdown for a Topic in the Catalog Modal
  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Toggle skill selection in catalog
  const toggleSelectSkill = (skillId: string) => {
    setSelectedCatalogIds((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  };

  // Select/Deselect All available skills in a topic group
  const toggleSelectAllInGroup = (group: SkillTreeGroup) => {
    const assignedIds = new Set(skills.map((s) => s.id));
    const availableSkills = group.skills.filter((s) => !assignedIds.has(s.id));
    if (availableSkills.length === 0) return;

    const allSelected = availableSkills.every((s) => selectedCatalogIds.has(s.id));
    setSelectedCatalogIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        availableSkills.forEach((s) => next.delete(s.id));
      } else {
        availableSkills.forEach((s) => next.add(s.id));
      }
      return next;
    });
  };

  // Assign selected skills to class
  const handleAssignSkills = async () => {
    if (selectedCatalogIds.size === 0) {
      toast.error("Please select at least one skill to add");
      return;
    }
    try {
      setAssigningLoading(true);
      const updated = await skillApi.assignSkillsToClass(classId, Array.from(selectedCatalogIds));
      setSkills(updated);
      toast.success(`Added ${selectedCatalogIds.size} skill(s) to this class`);
      setIsCatalogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add skills to class");
    } finally {
      setAssigningLoading(false);
    }
  };

  // Unassign skill from class
  const handleConfirmUnassign = async () => {
    if (!skillToUnassign) return;
    try {
      setUnassigningLoading(true);
      await skillApi.unassignSkillFromClass(classId, skillToUnassign.id);
      toast.success(`Removed "${skillToUnassign.name}" from class`);
      setSkillToUnassign(null);
      await fetchClassSkills();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove skill");
    } finally {
      setUnassigningLoading(false);
    }
  };

  // Extract unique domains for filter dropdown
  const domainOptions = React.useMemo(() => {
    const set = new Set<string>();
    skills.forEach((s) => {
      if (s.domain) set.add(s.domain);
    });
    return Array.from(set).sort();
  }, [skills]);

  // Filtered & Numerically Sorted Assigned Skills (matching Admin table layout)
  const filteredSkills = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = skills.filter((s) => {
      const matchesDomain =
        selectedDomainFilter === "ALL" || s.domain === selectedDomainFilter;
      if (!matchesDomain) return false;

      if (!term) return true;
      return (
        s.name.toLowerCase().includes(term) ||
        s.code.toLowerCase().includes(term) ||
        (s.display_id && s.display_id.toLowerCase().includes(term)) ||
        (s.domain && s.domain.toLowerCase().includes(term)) ||
        (s.sub_domain && s.sub_domain.toLowerCase().includes(term)) ||
        (s.skill_family && s.skill_family.toLowerCase().includes(term)) ||
        (s.classification && s.classification.toLowerCase().includes(term))
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
  }, [skills, search, selectedDomainFilter]);

  // Filter Catalog Groups by Search in Add Skill Modal
  const filteredCatalogGroups = React.useMemo(() => {
    const term = catalogSearch.trim().toLowerCase();
    if (!term) return catalogGroups;
    return catalogGroups
      .map((g) => {
        const matchesGroup =
          g.name.toLowerCase().includes(term) || g.code.toLowerCase().includes(term);
        const matchingSkills = g.skills.filter(
          (s) =>
            s.name.toLowerCase().includes(term) ||
            s.code.toLowerCase().includes(term) ||
            (s.display_id && s.display_id.toLowerCase().includes(term)) ||
            (s.domain && s.domain.toLowerCase().includes(term)) ||
            (s.sub_domain && s.sub_domain.toLowerCase().includes(term)) ||
            (s.skill_family && s.skill_family.toLowerCase().includes(term)) ||
            (s.description && s.description.toLowerCase().includes(term))
        );
        if (matchesGroup) return g;
        if (matchingSkills.length > 0) return { ...g, skills: matchingSkills };
        return null;
      })
      .filter((g): g is SkillTreeGroup => g !== null);
  }, [catalogGroups, catalogSearch]);

  // Assigned Skill IDs Set for fast lookup
  const assignedSkillIds = React.useMemo(() => {
    return new Set(skills.map((s) => s.id));
  }, [skills]);

  return (
    <div className="space-y-6">
      {/* Workspace Header with concise "Add Skill" button */}
      <ClassPageHeader
        title="Class Skills & Competencies"
        subtitle="Manage the standardized competencies assigned to this course for question classification and evaluation."
        actions={
          <Button
            onClick={handleOpenCatalog}
            className="flex items-center gap-1.5 bg-[#111111] hover:bg-black text-white text-xs px-3.5 py-2 font-semibold shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Skill</span>
          </Button>
        }
      />

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center gap-3">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Main View: Sub-Skills Table Layout matching Admin */}
      <div className="space-y-4">
        {/* Search & Filter Toolbar: Wide horizontal search without logo */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full sm:flex-1 sm:max-w-3xl">
            <input
              type="text"
              placeholder="Search assigned skills by name, ID, domain, family..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3.5 pr-8 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {domainOptions.length > 1 && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 shadow-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500">Domain:</span>
                <select
                  value={selectedDomainFilter}
                  onChange={(e) => setSelectedDomainFilter(e.target.value)}
                  className="bg-transparent border-none text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Domains ({skills.length})</option>
                  {domainOptions.map((dom) => (
                    <option key={dom} value={dom}>
                      {dom}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <span className="text-xs text-slate-500 font-medium">
              Total: <strong>{filteredSkills.length}</strong> skills
            </span>
          </div>
        </div>

        {/* Assigned Skills Table matching Admin Sub-Skills Layout */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-12 text-center text-slate-500 flex items-center justify-center gap-2 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              Loading class skills...
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="p-12 text-center">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">
                {search || selectedDomainFilter !== "ALL"
                  ? "No matching skills found"
                  : "No skills added to this class yet"}
              </h3>
              <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto">
                {search || selectedDomainFilter !== "ALL"
                  ? "Try adjusting your search query or domain filter."
                  : "Choose standardized skills from the catalog to configure competencies and evaluation rubrics for this class."}
              </p>
              {!search && selectedDomainFilter === "ALL" && (
                <Button
                  onClick={handleOpenCatalog}
                  className="flex items-center gap-1.5 bg-[#111111] hover:bg-black text-white text-xs px-3.5 py-2 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Skill</span>
                </Button>
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
                  <th className="py-3.5 px-4">Skill (Display) Name</th>
                  <th className="py-3.5 px-4">Skill Classification</th>
                  <th className="py-3.5 px-4 text-right pr-6 w-28">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSkills.map((skill, index) => {
                  const displayId = skill.display_id || String(index + 1);
                  return (
                    <tr
                      key={skill.id}
                      onClick={() => {
                        setModalSkill(skill);
                        setIsModalOpen(true);
                      }}
                      className="hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {displayId}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {skill.domain || "Information Technology"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {skill.sub_domain || "Software Engineering"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {skill.skill_family || "Programming Languages"}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {skill.name}
                      </td>
                      <td className="py-3.5 px-4">
                        {skill.classification === "Tool" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80">
                            Tool
                          </span>
                        ) : skill.classification === "Functional Skill" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                            Functional Skill
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200/80">
                            {skill.classification || "Technical Skill"}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right pr-6">
                        <div
                          className="flex items-center justify-end gap-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setModalSkill(skill);
                              setIsModalOpen(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-semibold text-xs"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => setSkillToUnassign(skill)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Remove from class"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* DIALOG: Choose Skills from Catalog with Topic Dropdowns      */}
      {/* ============================================================ */}
      <Dialog open={isCatalogOpen} onOpenChange={setIsCatalogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-5xl md:max-w-6xl lg:max-w-7xl max-h-[88vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Add Skills to Class
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Browse topics and dropdown to select specific sub-skills to include in this course.
            </DialogDescription>
          </DialogHeader>

          {/* Search Box inside Dialog */}
          <div className="relative mt-2">
            <input
              type="text"
              placeholder="Search skills or topics by name, ID, domain..."
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              className="w-full px-3.5 pr-8 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
            />
            {catalogSearch && (
              <button
                type="button"
                onClick={() => setCatalogSearch("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Topics Accordion List */}
          <div className="flex-1 overflow-y-auto mt-3 space-y-3 pr-1">
            {loadingCatalog ? (
              <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                Loading topics & skills...
              </div>
            ) : filteredCatalogGroups.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No matching skills found in catalog.
              </div>
            ) : (
              filteredCatalogGroups.map((group) => {
                const isSearchActive = catalogSearch.trim().length > 0;
                // Auto-expand if searching, otherwise obey user toggle state
                const isExpanded = isSearchActive || expandedGroupIds.has(group.id);

                const totalSkills = group.skills.length;
                const assignedCount = group.skills.filter((s) => assignedSkillIds.has(s.id)).length;
                const newlySelectedCount = group.skills.filter((s) => selectedCatalogIds.has(s.id)).length;
                const availableSkills = group.skills.filter((s) => !assignedSkillIds.has(s.id));
                const allAvailableSelected =
                  availableSkills.length > 0 &&
                  availableSkills.every((s) => selectedCatalogIds.has(s.id));

                return (
                  <div
                    key={group.id}
                    className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs transition-all"
                  >
                    {/* Topic Header: Click to dropdown */}
                    <div
                      onClick={() => toggleGroupExpand(group.id)}
                      className="px-4 py-3 bg-slate-50/80 hover:bg-slate-100/70 border-b border-slate-200 flex items-center justify-between cursor-pointer select-none transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          className="text-slate-400 hover:text-slate-600 transition-transform"
                          aria-label="Toggle group"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-blue-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-500" />
                          )}
                        </button>

                        <div className="min-w-0">
                          <h4 className="text-[14px] font-bold text-slate-900 truncate">
                            {group.name}
                          </h4>
                          {group.description && (
                            <p className="text-[11.5px] text-slate-500 line-clamp-1 mt-0.5">
                              {group.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {assignedCount > 0 && (
                          <span className="px-2 py-0.5 rounded text-[10.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {assignedCount} in class
                          </span>
                        )}
                        {newlySelectedCount > 0 && (
                          <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            +{newlySelectedCount} selected
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500 font-medium">
                          {totalSkills} skills
                        </span>
                      </div>
                    </div>

                    {/* Dropdown Content: Revealed only when clicked / expanded */}
                    {isExpanded && (
                      <div className="bg-white">
                        {/* Sub-header with Select All option */}
                        {availableSkills.length > 1 && (
                          <div className="px-4 py-2 bg-slate-50/40 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
                            <span>
                              {availableSkills.length} available to add
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectAllInGroup(group);
                              }}
                              className="text-blue-600 hover:text-blue-800 font-semibold text-[11.5px]"
                            >
                              {allAvailableSelected
                                ? "Deselect All Available"
                                : "Select All Available"}
                            </button>
                          </div>
                        )}

                        <div className="divide-y divide-slate-100">
                          {group.skills.map((sk) => {
                            const isAlreadyAssigned = assignedSkillIds.has(sk.id);
                            const isSelected = selectedCatalogIds.has(sk.id);

                            return (
                              <div
                                key={sk.id}
                                onClick={() => {
                                  if (!isAlreadyAssigned) toggleSelectSkill(sk.id);
                                }}
                                className={`p-3 px-4 flex items-center gap-3 transition-colors ${
                                  isAlreadyAssigned
                                    ? "bg-slate-50/60 opacity-60 cursor-not-allowed"
                                    : isSelected
                                    ? "bg-blue-50/50 cursor-pointer"
                                    : "hover:bg-slate-50/70 cursor-pointer"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isAlreadyAssigned || isSelected}
                                  disabled={isAlreadyAssigned}
                                  onChange={() => {
                                    if (!isAlreadyAssigned) toggleSelectSkill(sk.id);
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                                />

                                <span className="font-mono text-[11px] font-bold text-slate-800 w-16 shrink-0">
                                  {sk.display_id || sk.code}
                                </span>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h5 className="text-xs font-semibold text-slate-900 truncate">
                                      {sk.name}
                                    </h5>
                                    {isAlreadyAssigned ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-medium">
                                        <CheckCircle2 className="w-2.5 h-2.5" />
                                        In Class
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                    {sk.sub_domain && (
                                      <span>{sk.sub_domain}</span>
                                    )}
                                    {sk.sub_domain && sk.skill_family && (
                                      <span>&bull;</span>
                                    )}
                                    {sk.skill_family && (
                                      <span>{sk.skill_family}</span>
                                    )}
                                  </div>
                                </div>

                                <div className="shrink-0 flex items-center gap-2">
                                  {sk.classification === "Tool" ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80">
                                      Tool
                                    </span>
                                  ) : sk.classification === "Functional Skill" ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                                      Functional Skill
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-blue-50 text-blue-800 border border-blue-200/80">
                                      {sk.classification || "Technical Skill"}
                                    </span>
                                  )}

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setModalSkill(sk);
                                      setIsModalOpen(true);
                                    }}
                                    className="text-xs text-slate-400 hover:text-blue-600 p-1"
                                    title="View Skill Information"
                                  >
                                    View
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Selected: <strong>{selectedCatalogIds.size}</strong> new skill(s)
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCatalogOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={selectedCatalogIds.size === 0 || assigningLoading}
                onClick={handleAssignSkills}
                className="bg-[#111111] hover:bg-black text-white text-xs px-4"
              >
                {assigningLoading
                  ? "Adding..."
                  : `Add to Class (${selectedCatalogIds.size})`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: View Full Skill Information                          */}
      {/* ============================================================ */}
      <ViewSkillInfoModal
        skill={modalSkill}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        canEditRubric={false}
      />

      {/* ============================================================ */}
      {/* DIALOG: Confirm Unassign Skill                               */}
      {/* ============================================================ */}
      <ConfirmDialog
        isOpen={!!skillToUnassign}
        title="Remove Skill from Class"
        description={
          skillToUnassign
            ? `Are you sure you want to remove "${skillToUnassign.name}" (${skillToUnassign.code}) from this class? Questions mapped to this skill will no longer be tracked under this competency.`
            : ""
        }
        confirmLabel={unassigningLoading ? "Removing..." : "Remove Skill"}
        tone="danger"
        onConfirm={handleConfirmUnassign}
        onCancel={() => setSkillToUnassign(null)}
      />
    </div>
  );
}
