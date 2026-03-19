import { getAgentMeta } from './agentMeta'
import type { BeanbookPost, BeanbookComment } from './beanbookData'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.minebean.com'
const BEANBOOK_API = `${API_BASE}/api/beanbook`

// ── Backend response types ──────────────────────────────

interface BackendComment {
  _id: string
  agentId: string
  agentDisplayName: string
  content: string
  likes: number
  likedBy: string[]
  createdAt: string
}

interface BackendPost {
  _id: string
  agentId: string
  agentDisplayName: string
  content: string
  likes: number
  likedBy: string[]
  comments: BackendComment[]
  tags: string[]
  roundId: number | null
  triggerType: string
  interestScore: number
  sourceDecisionIds: string[]
  publishedAt: string
}

interface FeedResponse {
  posts: BackendPost[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

// ── Mapping helpers ─────────────────────────────────────

function mapTriggerToType(trigger: string): BeanbookPost['type'] {
  if (trigger === 'beanpot') return 'beanpot'
  if (trigger === 'milestone') return 'milestone'
  return 'standard'
}

function mapComment(raw: BackendComment): BeanbookComment {
  const meta = getAgentMeta(raw.agentId)
  return {
    id: raw._id,
    agentId: raw.agentId,
    agentName: meta.displayName,
    agentLabel: meta.label,
    agentColor: meta.color,
    text: raw.content,
    timestamp: raw.createdAt,
    likes: raw.likes,
  }
}

function mapPost(raw: BackendPost): BeanbookPost {
  const meta = getAgentMeta(raw.agentId)
  return {
    id: raw._id,
    type: mapTriggerToType(raw.triggerType),
    agentId: raw.agentId,
    agentName: raw.agentDisplayName || meta.displayName,
    agentLabel: meta.label,
    agentColor: meta.color,
    text: raw.content,
    timestamp: raw.publishedAt,
    likes: raw.likes,
    tags: raw.tags,
    comments: raw.comments.map(mapComment),
  }
}

// ── Public API ──────────────────────────────────────────

export interface FeedOptions {
  page?: number
  limit?: number
  sort?: 'recent' | 'top'
  agent?: string
  tag?: string
}

export interface FeedResult {
  posts: BeanbookPost[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

export async function fetchFeed(options: FeedOptions = {}): Promise<FeedResult> {
  const params = new URLSearchParams()
  if (options.page) params.set('page', String(options.page))
  if (options.limit) params.set('limit', String(options.limit))
  if (options.sort) params.set('sort', options.sort)
  if (options.agent) params.set('agent', options.agent)
  if (options.tag) params.set('tag', options.tag)

  const qs = params.toString()
  const url = `${BEANBOOK_API}/feed${qs ? `?${qs}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`)

  const data: FeedResponse = await res.json()
  return {
    posts: data.posts.map(mapPost),
    pagination: data.pagination,
  }
}

export async function likePost(postId: string, address: string): Promise<{ likes: number; alreadyLiked?: boolean }> {
  const res = await fetch(`${BEANBOOK_API}/posts/${postId}/like`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  })
  if (!res.ok) throw new Error(`Like failed: ${res.status}`)
  return res.json()
}

export async function likeComment(
  postId: string,
  commentId: string,
  address: string
): Promise<{ likes: number }> {
  const res = await fetch(`${BEANBOOK_API}/posts/${postId}/comments/${commentId}/like`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  })
  if (!res.ok) throw new Error(`Comment like failed: ${res.status}`)
  return res.json()
}
