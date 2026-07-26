/**
 * Todo service API client.
 * Integrates with python-todo-service-fastapi (default port 8650).
 * Set VITE_TODO_API_URL in .env to point to your todo service.
 */

import { serviceApiBase } from './gatewayBase'
import { apiFetch, tectonaServiceHeaders } from './httpClient'

const BASE_URL = serviceApiBase('/api/todo', import.meta.env.VITE_TODO_API_URL)

function buildTodoUrl(pathname: string): URL {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  const base = BASE_URL.replace(/\/$/, '')
  if (base.startsWith('http://') || base.startsWith('https://')) {
    return new URL(`${base}${path}`)
  }
  return new URL(`${base}${path}`, window.location.origin)
}

/** App GUID for Tectona (todo service app_id). */
export const TECTONA_TODO_APP_ID = '00000000-0000-0000-0000-000000000001'

/** Entity type IDs (todo-service seed_data). Use for entity_links. */
export const TODO_ENTITY_TYPE = {
  project: '550e8400-e29b-41d4-a716-446655449001',
  general: '550e8400-e29b-41d4-a716-446655449009',
} as const

/** Link role: subject (todo is for this entity). */
export const TODO_LINK_ROLE_SUBJECT = '550e8400-e29b-41d4-a716-446655449051'

/** General entity_id when no specific entity (per backend convention). */
export const TODO_ENTITY_ID_GENERAL = '00000000-0000-0000-0000-000000000000'

/** Build entity_links for create: project → one link; no entity → general. */
export function buildTodoEntityLinks(context?: { projectId?: string } | null): TodoEntityLinkItem[] {
  if (context?.projectId) {
    return [
      { entity_type_id: TODO_ENTITY_TYPE.project, entity_id: context.projectId, link_role_id: TODO_LINK_ROLE_SUBJECT },
    ]
  }
  return [
    { entity_type_id: TODO_ENTITY_TYPE.general, entity_id: TODO_ENTITY_ID_GENERAL, link_role_id: TODO_LINK_ROLE_SUBJECT },
  ]
}

/** Priority lookup IDs (from todo-service seed_data). Use for create/update priority_ids. */
export const TODO_PRIORITY_IDS = {
  low: '550e8400-e29b-41d4-a716-446655449101',
  medium: '550e8400-e29b-41d4-a716-446655449102',
  high: '550e8400-e29b-41d4-a716-446655449103',
} as const
export type TodoPriorityCode = keyof typeof TODO_PRIORITY_IDS

/** Category lookup IDs (from todo-service seed_data: personal, work, other). Use for update category_ids. General = no category (empty). */
export const TODO_CATEGORY_IDS: Record<string, string | null> = {
  Personal: '550e8400-e29b-41d4-a716-446655449201',
  Work: '550e8400-e29b-41d4-a716-446655449202',
  General: null, // no category
} as const

export interface TodoEntityLinkItem {
  entity_type_id: string
  entity_id: string
  link_role_id: string
  entity_type_code?: string
}

export interface TodoPriorityItem {
  priority_id: string
  priority_code: string
}

export interface TodoCategoryItem {
  id: string
  code: string
  name: string
  color?: string | null
}

export interface TodoItem {
  id: string
  app_id: string
  title: string
  description: string | null
  is_completed: boolean
  completed_at: string | null
  due_date: string | null
  display_order: number
  is_flagged?: boolean
  created_by: string
  created_date: string
  created_from: string
  updated_by: string | null
  updated_date: string | null
  updated_from: string | null
  entity_links: TodoEntityLinkItem[]
  priorities: TodoPriorityItem[]
  categories?: TodoCategoryItem[]
}

export interface TodoListResponse {
  todos: TodoItem[]
  total: number
  page: number
  page_size: number
}

export interface TodoCreatePayload {
  title: string
  description?: string | null
  app_id?: string
  due_date?: string | null
  display_order?: number
  entity_links?: TodoEntityLinkItem[] | null
  priority_ids?: string[] | null
}

export interface TodoUpdatePayload {
  title?: string | null
  description?: string | null
  is_completed?: boolean | null
  due_date?: string | null
  display_order?: number | null
  entity_links?: TodoEntityLinkItem[] | null
  priority_ids?: string[] | null
  category_ids?: string[] | null
  is_flagged?: boolean | null
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export async function fetchTodos(params?: {
  app_id?: string
  is_completed?: boolean
  entity_type_id?: string
  entity_id?: string
  page?: number
  page_size?: number
}): Promise<TodoListResponse> {
  const url = buildTodoUrl('/v1/todos')
  if (params?.app_id) url.searchParams.set('app_id', params.app_id)
  if (params?.is_completed !== undefined) url.searchParams.set('is_completed', String(params.is_completed))
  if (params?.entity_type_id) url.searchParams.set('entity_type_id', params.entity_type_id)
  if (params?.entity_id) url.searchParams.set('entity_id', params.entity_id)
  if (params?.page) url.searchParams.set('page', String(params.page))
  if (params?.page_size) url.searchParams.set('page_size', String(params.page_size ?? 50))
  const res = await apiFetch(url.toString())
  return handleResponse<TodoListResponse>(res)
}

export async function createTodo(payload: TodoCreatePayload): Promise<TodoItem> {
  const res = await apiFetch(`${BASE_URL}/v1/todos`, {
    method: 'POST',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify({
      ...payload,
      app_id: payload.app_id ?? TECTONA_TODO_APP_ID,
    }),
  })
  return handleResponse<TodoItem>(res)
}

export async function updateTodo(id: string, payload: TodoUpdatePayload): Promise<TodoItem> {
  const res = await apiFetch(`${BASE_URL}/v1/todos/${id}`, {
    method: 'PUT',
    headers: tectonaServiceHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse<TodoItem>(res)
}

export async function deleteTodo(id: string): Promise<void> {
  const res = await apiFetch(`${BASE_URL}/v1/todos/${id}`, { method: 'DELETE' })
  await handleResponse<void>(res)
}
