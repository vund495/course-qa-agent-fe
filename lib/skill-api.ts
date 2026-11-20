import { AUTH_TOKEN_KEY } from "@/components/ui/nav-config";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type SkillLevel = "NOVICE" | "BEGINNER" | "COMPETENT" | "PROFICIENT" | "MASTER";

export type SkillLevelRubric = {
  id: string;
  skill_id: string;
  level: SkillLevel;
  description: string;
  threshold_pct: number;
  created_at: string;
  updated_at: string;
};

export type SkillGroup = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  skills_count: number;
  created_at: string;
  updated_at: string;
};

export type SkillCourse = {
  class_id: string;
  class_code: string;
  class_name: string;
  trainer_name?: string | null;
  semester?: string | null;
  academic_year?: string | null;
  assigned_at?: string | null;
};

export type Skill = {
  id: string;
  display_id?: string | null;
  group_id: string | null;
  group_name?: string | null;
  code: string;
  name: string;
  domain?: string;
  sub_domain?: string;
  skill_family?: string;
  classification?: string;
  category: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  rubrics: SkillLevelRubric[];
  courses?: SkillCourse[];
};

export type SkillTreeGroup = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  skills: Skill[];
};

export type SkillCreatePayload = {
  code: string;
  name: string;
  display_id?: string;
  group_id?: string | null;
  domain?: string;
  sub_domain?: string;
  skill_family?: string;
  classification?: string;
  category?: string;
  description?: string;
  rubrics?: {
    level: SkillLevel;
    description: string;
    threshold_pct?: number;
  }[];
};

export type SkillGroupCreatePayload = {
  code: string;
  name: string;
  description?: string;
};

export type SkillGroupUpdatePayload = {
  name?: string;
  description?: string;
};

export type RubricUpdatePayload = {
  description: string;
  threshold_pct?: number;
};

function token(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(AUTH_TOKEN_KEY);
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body?.detail || `Request failed with status ${res.status}`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  if (res.status === 204) {
    return {} as T;
  }
  return res.json() as Promise<T>;
}

export const skillApi = {
  // --- Admin API ---
  async listGroups(): Promise<SkillGroup[]> {
    const auth = token();
    const res = await fetch(`${API_URL}/api/admin/skills/groups`, {
      headers: auth ? { Authorization: `Bearer ${auth}` } : {},
    });
    return handleResponse<SkillGroup[]>(res);
  },

  async createGroup(payload: SkillGroupCreatePayload): Promise<SkillGroup> {
    const auth = token();
    const res = await fetch(`${API_URL}/api/admin/skills/groups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<SkillGroup>(res);
  },

  async updateGroup(groupId: string, payload: SkillGroupUpdatePayload): Promise<SkillGroup> {
    const auth = token();
    const res = await fetch(`${API_URL}/api/admin/skills/groups/${groupId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<SkillGroup>(res);
  },

  async deleteGroup(groupId: string): Promise<void> {
    const auth = token();
    const res = await fetch(`${API_URL}/api/admin/skills/groups/${groupId}`, {
      method: "DELETE",
      headers: auth ? { Authorization: `Bearer ${auth}` } : {},
    });
    return handleResponse<void>(res);
  },

  async listAdminSkills(groupId?: string, search?: string): Promise<Skill[]> {
    const auth = token();
    const url = new URL(`${API_URL}/api/admin/skills`);
    if (groupId) url.searchParams.set("group_id", groupId);
    if (search) url.searchParams.set("search", search);

    const res = await fetch(url.toString(), {
      headers: auth ? { Authorization: `Bearer ${auth}` } : {},
    });
    return handleResponse<Skill[]>(res);
  },

  async createAdminSkill(payload: SkillCreatePayload): Promise<Skill> {
    const auth = token();
    const res = await fetch(`${API_URL}/api/admin/skills`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<Skill>(res);
  },

  async updateAdminSkill(
    skillId: string,
    payload: {
      name?: string;
      group_id?: string | null;
      display_id?: string;
      domain?: string;
      sub_domain?: string;
      skill_family?: string;
      classification?: string;
      category?: string;
      description?: string;
    }
  ): Promise<Skill> {
    const auth = token();
    const res = await fetch(`${API_URL}/api/admin/skills/${skillId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<Skill>(res);
  },

  async deleteAdminSkill(skillId: string): Promise<void> {
    const auth = token();
    const res = await fetch(`${API_URL}/api/admin/skills/${skillId}`, {
      method: "DELETE",
      headers: auth ? { Authorization: `Bearer ${auth}` } : {},
    });
    return handleResponse<void>(res);
  },

  async updateAdminRubric(
    skillId: string,
    level: SkillLevel,
    payload: RubricUpdatePayload
  ): Promise<SkillLevelRubric> {
    const auth = token();
    const res = await fetch(`${API_URL}/api/admin/skills/${skillId}/rubrics/${level}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<SkillLevelRubric>(res);
  },

  // --- Catalog API (For browsing taxonomy) ---
  async getCatalogTree(): Promise<SkillTreeGroup[]> {
    const auth = token();
    const res = await fetch(`${API_URL}/api/skills/catalog`, {
      headers: auth ? { Authorization: `Bearer ${auth}` } : {},
    });
    return handleResponse<SkillTreeGroup[]>(res);
  },

  // --- Class Scoped API (For trainers) ---
  async listClassSkills(classId: string): Promise<Skill[]> {
    const auth = token();
    const res = await fetch(`${API_URL}/api/classes/${classId}/skills`, {
      headers: auth ? { Authorization: `Bearer ${auth}` } : {},
    });
    return handleResponse<Skill[]>(res);
  },

  async assignSkillsToClass(classId: string, skillIds: string[]): Promise<Skill[]> {
    const auth = token();
    const res = await fetch(`${API_URL}/api/classes/${classId}/skills/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify({ skill_ids: skillIds }),
    });
    return handleResponse<Skill[]>(res);
  },

  async unassignSkillFromClass(classId: string, skillId: string): Promise<void> {
    const auth = token();
    const res = await fetch(`${API_URL}/api/classes/${classId}/skills/${skillId}`, {
      method: "DELETE",
      headers: auth ? { Authorization: `Bearer ${auth}` } : {},
    });
    return handleResponse<void>(res);
  },
};
