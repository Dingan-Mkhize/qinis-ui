const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type PipelineStage =
  | 'premise'
  | 'protagonist'
  | 'core_story_engine'
  | 'logline'
  | 'character_system'
  | 'beat_board'
  | 'export'

export type StoryType = 'comedy' | 'tragedy' | null

export type CardType = 'foundational' | 'structural' | 'writer'

export type BodySource = 'bible' | 'manual' | 'generated'

export type Act = 'act_1' | 'act_2a' | 'midpoint' | 'act_2b' | 'act_3'

export interface BeatCard {
  id: string
  beat_number: number
  title: string
  body: string
  body_source: BodySource
  act: Act
  card_type: CardType
  position: number
}

export interface BeatBoard {
  cards: BeatCard[]
}

export interface Project {
  id: number
  title: string
  current_stage: number
  pipeline_data: Record<string, unknown>
  story_bible: Record<string, unknown>
  story_bible_history: Record<string, unknown>[]
  consistency_log: Record<string, unknown>[]
  beat_board: BeatBoard
  logline: string
  logline_word_count: number
  logline_amber: boolean
  story_type: StoryType
  bible_version: number
  lock_version: number
  created_at: string
  updated_at: string
}

export interface PipelineState {
  project: Project
  stage: PipelineStage
  stage_data: Record<string, unknown>
}

export interface ConsistencyResult {
  valid: boolean
  conflicts: string[]
  resolved: boolean
}

export interface AdvanceResponse {
  project: Project
  consistency: ConsistencyResult
}

export interface ReviseResponse {
  project: Project
  downstream_amber_flags: string[]
  consistency: ConsistencyResult
}

export interface SessionPayload {
  email: string
  password: string
}

export interface SessionResponse {
  user: { email: string }
}

export interface ProjectCreatePayload {
  title: string
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init.headers,
    },
  })

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = body.error ?? body.message ?? message
    } catch {
      // non-JSON error body — keep statusText
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

async function apiDownload(path: string, accept: string): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { Accept: accept },
  })

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = body.error ?? body.message ?? message
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, message)
  }

  return res
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const sessions = {
  create: (payload: SessionPayload) =>
    apiFetch<SessionResponse>('/api/v1/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  destroy: () =>
    apiFetch<void>('/api/v1/sessions', { method: 'DELETE' }),
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projects = {
  index: () => apiFetch<Project[]>('/api/v1/projects'),

  create: (payload: ProjectCreatePayload) =>
    apiFetch<Project>('/api/v1/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  show: (id: number) => apiFetch<Project>(`/api/v1/projects/${id}`),

  destroy: (id: number) =>
    apiFetch<void>(`/api/v1/projects/${id}`, { method: 'DELETE' }),
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export const pipeline = {
  current: (projectId: number) =>
    apiFetch<PipelineState>(`/api/v1/pipeline/${projectId}/current`),

  advance: (projectId: number, payload: Record<string, unknown>) =>
    apiFetch<AdvanceResponse>(`/api/v1/pipeline/${projectId}/advance`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  revise: (
    projectId: number,
    payload: { stage: PipelineStage } & Record<string, unknown>,
  ) =>
    apiFetch<ReviseResponse>(`/api/v1/pipeline/${projectId}/revise`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}

// ---------------------------------------------------------------------------
// Beats
// ---------------------------------------------------------------------------

export const beats = {
  // drag a structural card from the sidebar queue onto the board
  place: (projectId: number, payload: { beat_number: number }) =>
    apiFetch<BeatCard>(`/api/v1/projects/${projectId}/beats/place`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // add a new writer card
  add: (projectId: number, payload: { title: string; act: Act }) =>
    apiFetch<BeatCard>(`/api/v1/projects/${projectId}/beats`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // update body, act, title, or position on any card
  update: (
    projectId: number,
    beatId: string,
    payload: Partial<Pick<BeatCard, 'body' | 'act' | 'title' | 'position'>>,
  ) =>
    apiFetch<BeatCard>(`/api/v1/projects/${projectId}/beats/${beatId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // delete a writer card (foundational/structural rejected server-side)
  delete: (projectId: number, beatId: string) =>
    apiFetch<void>(`/api/v1/projects/${projectId}/beats/${beatId}`, {
      method: 'DELETE',
    }),

  // persist new card order after a drag-and-drop
  reorder: (projectId: number, payload: { ordered_ids: string[] }) =>
    apiFetch<BeatBoard>(`/api/v1/projects/${projectId}/beats/reorder`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ask Claude to generate body text for a single card
  generate_body: (projectId: number, beatId: string) =>
    apiFetch<BeatCard>(
      `/api/v1/projects/${projectId}/beats/${beatId}/generate_body`,
      { method: 'POST' },
    ),
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const exportApi = {
  pdf_beat_board: (projectId: number): Promise<Blob> =>
    apiDownload(
      `/api/v1/projects/${projectId}/export/pdf_beat_board`,
      'application/pdf',
    ).then((res) => res.blob()),

  text_beat_sheet: (projectId: number): Promise<string> =>
    apiDownload(
      `/api/v1/projects/${projectId}/export/text_beat_sheet`,
      'text/plain',
    ).then((res) => res.text()),

  story_document: (projectId: number): Promise<Blob> =>
    apiDownload(
      `/api/v1/projects/${projectId}/export/story_document`,
      'application/pdf',
    ).then((res) => res.blob()),
}
