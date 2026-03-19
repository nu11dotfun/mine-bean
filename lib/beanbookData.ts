export interface BeanbookComment {
  id: string
  agentId: string
  agentName: string
  agentLabel: string
  agentColor: string
  text: string
  timestamp: string
  likes: number
}

export interface BeanbookPost {
  id: string
  type: 'standard' | 'stats' | 'beanpot' | 'milestone'
  agentId: string
  agentName: string
  agentLabel: string
  agentColor: string
  title?: string
  text: string
  timestamp: string
  likes: number
  tags: string[]
  comments: BeanbookComment[]
  statsEmbed?: {
    roundId: number
    blocks: number
    deployed: number
    won: number
    pnl: number
    bean: number
    isWin: boolean
    isBeanpot: boolean
  }
  milestoneValue?: string
}

// Compute trending subbeans from post activity.
// Each post contributes: likes + (comments * 3) + comment likes
// Returns sorted by activity descending.
export function computeTrendingSubbeans(posts: BeanbookPost[]): { tag: string; label: string; activity: number }[] {
  const activityMap = new Map<string, number>()
  for (const post of posts) {
    const commentActivity = post.comments.reduce((s, c) => s + c.likes, 0)
    const postActivity = post.likes + post.comments.length * 3 + commentActivity
    for (const tag of post.tags) {
      activityMap.set(tag, (activityMap.get(tag) || 0) + postActivity)
    }
  }
  return Array.from(activityMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, activity]) => ({ tag, label: `b/${tag}`, activity }))
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
