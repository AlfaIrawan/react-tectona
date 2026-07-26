import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProjectApi } from '@/lib/api/projectApi'
import {
  fetchProjects as fetchProjectsApi,
  createProject as createProjectApi,
  updateProject as updateProjectApi,
  archiveProject as archiveProjectApi,
  deleteProject as deleteProjectApi,
} from '@/lib/api/projectApi'

export type ProjectStatus = 'active' | 'archived'

export interface Project {
  id: string
  name: string
  description?: string
  tags?: string[]
  iconName?: string
  borderColor?: string
  ownerId?: string
  ownerName?: string
  members?: {
    userId: string
    displayName: string
    roleCode: string
    roleName: string
  }[]
  status: ProjectStatus
  folderId?: string | null
  createdAt: string
  updatedAt: string
}

export function mapApiToProject(api: ProjectApi): Project {
  return {
    id: api.id,
    name: api.name,
    description: api.description ?? undefined,
    tags: api.tags ?? [],  // Keep as array (even if empty) for consistent handling
    iconName: api.icon_name ?? undefined,
    borderColor: api.border_color ?? undefined,
    folderId: api.folder_id ?? undefined,
    ownerId: api.owner_id,
    ownerName: api.owner_name ?? 'Admin User',
    members: (api.members ?? []).map((m) => ({
      userId: m.user_id,
      displayName: m.display_name,
      roleCode: m.role_code,
      roleName: m.role_name,
    })),
    status: (api.status_code === 'archived' ? 'archived' : 'active') as ProjectStatus,
    createdAt: api.created_date,
    updatedAt: api.updated_date ?? api.created_date,
  }
}

interface ProjectState {
  projects: Project[]
  projectsLoading: boolean
  projectsError: string | null
  fetchProjects: () => Promise<void>
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { tags?: string[]; iconName?: string; borderColor?: string; folderId?: string | null }) => Promise<Project>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  archiveProject: (id: string) => Promise<void>
  archiveProjects: (ids: string[]) => Promise<void>
  restoreProject: (id: string) => Promise<void>
  restoreProjects: (ids: string[]) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  deleteProjects: (ids: string[]) => Promise<void>
  getProject: (id: string) => Project | undefined
  searchProjects: (query: string) => Project[]
  moveProjectToFolder: (projectId: string, folderId: string | null) => Promise<void>
  moveProjectsToFolder: (projectIds: string[], folderId: string | null) => Promise<void>
  getProjectsByFolder: (folderId: string | null) => Project[]
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      projectsLoading: false,
      projectsError: null,

      fetchProjects: async () => {
        set({ projectsLoading: true, projectsError: null })
        try {
          const res = await fetchProjectsApi({ page: 1, page_size: 100 })
          const projects = res.projects.map(mapApiToProject)
          set({ projects, projectsLoading: false, projectsError: null })
        } catch (e) {
          const raw = e instanceof Error ? e.message : 'Failed to fetch projects'
          const msg =
            raw === 'Failed to fetch' || raw.toLowerCase().includes('network')
              ? 'Tidak dapat terhubung ke Project Service. Pastikan python-project-service-fastapi berjalan di port 8500 (atau set VITE_PROJECT_API_URL di .env).'
              : raw
          set({ projectsLoading: false, projectsError: msg })
        }
      },

      addProject: async (projectData) => {
        const created = await createProjectApi({
          name: projectData.name,
          description: projectData.description,
          tags: projectData.tags,
          icon_name: projectData.iconName,
          border_color: projectData.borderColor,
          folder_id: projectData.folderId ?? null,
        })
        await get().fetchProjects()
        const project = mapApiToProject(created)
        const found = get().projects.find((p) => p.id === project.id)
        return found ?? project
      },

      updateProject: async (id, updates) => {
        const payload: { name?: string; description?: string; status_id?: string; tags?: string[]; icon_name?: string; border_color?: string; folder_id?: string | null } = {}
        if (updates.name != null) payload.name = updates.name
        if (updates.description != null) payload.description = updates.description
        if (updates.tags != null) payload.tags = updates.tags
        if (updates.iconName != null) payload.icon_name = updates.iconName
        if (updates.borderColor != null) payload.border_color = updates.borderColor
        if (updates.folderId !== undefined) payload.folder_id = updates.folderId ?? null
        if (updates.status === 'archived') {
          payload.status_id = '550e8400-e29b-41d4-a716-446655440102'
        } else if (updates.status === 'active') {
          payload.status_id = '550e8400-e29b-41d4-a716-446655440101'
        }
        await updateProjectApi(id, payload)
        // Optimistic update: apply saved borderColor/iconName to local state so card color does not flicker or revert before fetch completes
        const current = get().projects
        const idx = current.findIndex((p) => p.id === id)
        if (idx >= 0) {
          const next = [...current]
          const prev = next[idx]
          next[idx] = {
            ...prev,
            ...(updates.name != null && { name: updates.name }),
            ...(updates.description != null && { description: updates.description }),
            ...(updates.tags != null && { tags: updates.tags }),
            ...(updates.iconName != null && { iconName: updates.iconName }),
            ...(updates.borderColor != null && { borderColor: updates.borderColor }),
            ...(updates.folderId !== undefined && { folderId: updates.folderId }),
            ...(updates.status != null && { status: updates.status }),
          }
          set({ projects: next })
        }
        await get().fetchProjects()
      },

      archiveProject: async (id) => {
        await archiveProjectApi(id)
        await get().fetchProjects()
      },

      archiveProjects: async (ids) => {
        if (ids.length === 0) return
        await Promise.all(ids.map((id) => archiveProjectApi(id)))
        await get().fetchProjects()
      },

      restoreProject: async (id) => {
        // Restore to active status
        await updateProjectApi(id, { status_id: '550e8400-e29b-41d4-a716-446655440101' })
        await get().fetchProjects()
      },

      restoreProjects: async (ids) => {
        if (ids.length === 0) return
        const activeStatusId = '550e8400-e29b-41d4-a716-446655440101'
        await Promise.all(ids.map((id) => updateProjectApi(id, { status_id: activeStatusId })))
        await get().fetchProjects()
      },

      deleteProject: async (id) => {
        await deleteProjectApi(id)
        await get().fetchProjects()
      },

      deleteProjects: async (ids) => {
        if (ids.length === 0) return
        await Promise.all(ids.map((id) => deleteProjectApi(id)))
        await get().fetchProjects()
      },

      getProject: (id) => {
        return get().projects.find((p) => p.id === id)
      },

      searchProjects: (query) => {
        const lowerQuery = query.toLowerCase()
        return get().projects.filter(
          (project) =>
            project.name.toLowerCase().includes(lowerQuery) ||
            project.description?.toLowerCase().includes(lowerQuery) ||
            project.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
        )
      },

      moveProjectToFolder: async (projectId, folderId) => {
        await get().updateProject(projectId, { folderId })
      },

      moveProjectsToFolder: async (projectIds, folderId) => {
        // Move all projects in parallel
        await Promise.all(
          projectIds.map((id) => get().updateProject(id, { folderId }))
        )
      },

      getProjectsByFolder: (folderId) => {
        return get().projects.filter(
          (project) => project.folderId === folderId
        )
      },
    }),
    {
      name: 'project-storage',
      partialize: (state) => ({ projects: state.projects }),
    }
  )
)
