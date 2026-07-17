'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useProfileResolver } from '@/lib/useProfileResolver'

// Live miners chat. Collapsed to a speech-bubble tab on the left edge (below
// the leaderboard tab), expands into a sidebar that starts below the nav bar.
// Reads flow straight from Supabase Realtime (anon key, RLS-limited to visible
// messages); every write goes through /api/chat/* where the moderation filter
// chain runs.

interface ChatMessage {
  id: string
  wallet: string
  body: string
  created_at: string
}

type SessionState = 'unknown' | 'none' | 'ready'

const MAX_LENGTH = 500
const GROUP_GAP_MS = 5 * 60 * 1000

// Must match loginMessage() in lib/chat/session.ts (server-only module).
const loginMessage = (addressLower: string, timestamp: number) =>
  `BEAN Protocol Chat Login\nAddress: ${addressLower}\nTimestamp: ${timestamp}`

const byCreatedAt = (a: ChatMessage, b: ChatMessage) =>
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()

const BubbleIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
)

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const SendIcon = ({ dim }: { dim: boolean }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={dim ? 'rgba(255,255,255,0.3)' : '#fff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

const ClockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
)

const FlagIcon = ({ active }: { active: boolean }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill={active ? '#fff' : 'none'} stroke={active ? '#fff' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
)

export default function ChatPanel() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [unread, setUnread] = useState(0)
  const [session, setSession] = useState<SessionState>('unknown')
  const [signing, setSigning] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [reported, setReported] = useState<Set<string>>(new Set())
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [timeoutMenuId, setTimeoutMenuId] = useState<string | null>(null)
  const [isModUser, setIsModUser] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [panelTop, setPanelTop] = useState(0)

  const openRef = useRef(false)
  const atBottomRef = useRef(true)
  const seenIds = useRef<Set<string>>(new Set())
  const listRef = useRef<HTMLDivElement>(null)
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const signGen = useRef(0)
  const addressRef = useRef<string | undefined>(address)

  useEffect(() => {
    addressRef.current = address
  }, [address])

  // Clear any timers that outlive the component.
  useEffect(
    () => () => {
      if (errorTimer.current) clearTimeout(errorTimer.current)
      if (watchdogRef.current) clearTimeout(watchdogRef.current)
    },
    []
  )

  const wallets = useMemo(() => Array.from(new Set(messages.map((m) => m.wallet))), [messages])
  const { profiles, resolve } = useProfileResolver(wallets)

  useEffect(() => {
    setMounted(true)
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Pin the panel to the nav bar's real bottom edge — measured from the DOM,
  // re-measured on resize and scroll (the header scrolls with the page).
  useEffect(() => {
    if (!mounted) return
    const measure = () => {
      const header = document.querySelector('header')
      setPanelTop(header ? Math.max(0, Math.round(header.getBoundingClientRect().bottom)) : 0)
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, { passive: true })
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
    }
  }, [mounted])

  // Initial history + realtime: INSERTs (RLS shows visible rows only) plus the
  // moderation broadcast that tells open clients to drop hidden messages.
  useEffect(() => {
    if (!mounted || isMobile) return
    let cancelled = false

    supabase
      .from('chat_messages')
      .select('id, wallet, body, created_at')
      .eq('status', 'visible')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (cancelled || !data) return
        const list = [...(data as ChatMessage[])].reverse()
        list.forEach((m) => seenIds.current.add(m.id))
        // Merge, don't replace: realtime rows that arrived while this request
        // was in flight must survive (their ids are already in seenIds, so a
        // clobber here would lose them permanently).
        setMessages((prev) => {
          const extra = prev.filter((m) => !list.some((h) => h.id === m.id))
          return [...list, ...extra].sort(byCreatedAt).slice(-200)
        })
      })

    // Unique per-mount topic: supabase-js hands back the existing instance for
    // a reused topic name, and resubscribing a channel that is mid-leave is a
    // silent no-op — a Fast Refresh or breakpoint remount would otherwise kill
    // realtime until a full page reload.
    const msgChannel = supabase
      .channel(`chat:messages:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const row = payload.new as ChatMessage & { status?: string }
          if (row.status && row.status !== 'visible') return
          if (seenIds.current.has(row.id)) return
          seenIds.current.add(row.id)
          const clean: ChatMessage = {
            id: row.id,
            wallet: row.wallet,
            body: row.body,
            created_at: row.created_at,
          }
          const own = row.wallet === addressRef.current?.toLowerCase()
          setMessages((prev) => {
            // If this is the echo of our own optimistic send arriving before
            // the POST response, swap it into the temp row instead of
            // appending a duplicate next to it.
            if (own) {
              const tmpIdx = prev.findIndex((m) => m.id.startsWith('tmp-') && m.body === row.body)
              if (tmpIdx !== -1) {
                const next = [...prev]
                next[tmpIdx] = clean
                return next.sort(byCreatedAt).slice(-200)
              }
            }
            return [...prev.slice(-199), clean]
          })
          if (!openRef.current && !own) setUnread((u) => Math.min(u + 1, 99))
        }
      )
      .subscribe()

    // Moderation events are hints, not commands: before acting, verify against
    // the database (RLS hides hidden/deleted rows), so a forged broadcast from
    // another client can neither censor nor resurrect anything.
    const verifyThenDrop = async ({ payload }: { payload: unknown }) => {
      const id = (payload as { id?: string })?.id
      if (!id) return
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('id', id)
        .maybeSingle()
      // Fail safe: an errored verify keeps the message; only a confirmed
      // row-absent (hidden/deleted under RLS) result drops it.
      if (error) return
      if (!data && !cancelled) setMessages((prev) => prev.filter((m) => m.id !== id))
    }
    const verifyThenShow = async ({ payload }: { payload: unknown }) => {
      const id = (payload as { id?: string })?.id
      if (!id) return
      const { data } = await supabase
        .from('chat_messages')
        .select('id, wallet, body, created_at')
        .eq('id', id)
        .maybeSingle()
      if (!data || cancelled) return
      const row = data as ChatMessage
      seenIds.current.add(row.id)
      setMessages((prev) =>
        prev.some((m) => m.id === row.id) ? prev : [...prev, row].sort(byCreatedAt).slice(-200)
      )
    }

    // The moderation topic must stay literally 'chat:moderation' (the server
    // broadcasts to it), so drop any stale instance from a previous mount
    // before subscribing. Private first (receive-only under realtime RLS);
    // fall back to a public subscribe ONLY if the private join is rejected
    // before ever succeeding (authorization not provisioned) — a channel that
    // already joined and later errors is a socket blip, and the library
    // self-heals it via its own rejoin timer. The server dual-publishes to
    // both variants, and verify-before-act keeps the public copy safe.
    let modChannel: RealtimeChannel | null = null
    let fellBack = false
    const teardownStaleModeration = () => {
      supabase.getChannels().forEach((c) => {
        if (c.topic === 'realtime:chat:moderation') {
          // Force-close zombies (a leave answered with 'error' leaves the
          // instance in the client list, and channel() would reuse it).
          ;(c as unknown as { teardown?: () => void }).teardown?.()
        }
      })
    }
    const subscribeModeration = (asPrivate: boolean): RealtimeChannel => {
      let reachedSubscribed = false
      const ch = supabase
        .channel('chat:moderation', { config: { private: asPrivate } })
        .on('broadcast', { event: 'hide' }, verifyThenDrop)
        .on('broadcast', { event: 'delete' }, verifyThenDrop)
        .on('broadcast', { event: 'show' }, verifyThenShow)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') reachedSubscribed = true
          if (
            asPrivate &&
            status === 'CHANNEL_ERROR' &&
            !reachedSubscribed &&
            !fellBack &&
            !cancelled
          ) {
            fellBack = true
            supabase.removeChannel(ch).then(() => {
              teardownStaleModeration()
              if (!cancelled) modChannel = subscribeModeration(false)
            })
          }
        })
      return ch
    }

    const stale = supabase
      .getChannels()
      .find((c) => c.topic === 'realtime:chat:moderation')
    Promise.resolve(stale ? supabase.removeChannel(stale) : null).then(() => {
      teardownStaleModeration()
      if (!cancelled) modChannel = subscribeModeration(true)
    })

    return () => {
      cancelled = true
      supabase.removeChannel(msgChannel)
      if (modChannel) supabase.removeChannel(modChannel)
    }
  }, [mounted, isMobile])

  // Keep the list pinned to the bottom unless the user scrolled up.
  useEffect(() => {
    if (!open || !listRef.current) return
    if (atBottomRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, open])

  useEffect(() => {
    openRef.current = open
    if (open) {
      setUnread(0)
      requestAnimationFrame(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
      })
    }
  }, [open])

  // Session check: on open, see if a valid cookie already covers this wallet.
  useEffect(() => {
    setSession('unknown')
    setIsModUser(false)
  }, [address])

  // Request-id guard instead of a cancel flag: a re-render mid-check must not
  // strand the state machine at 'unknown' — only a NEWER check may supersede
  // this one, and the latest check always writes its result.
  const sessionCheckId = useRef(0)
  useEffect(() => {
    if (!open || !isConnected || !address || session !== 'unknown') return
    const id = ++sessionCheckId.current
    const wanted = address.toLowerCase()
    // Hard timeout: a hung request must resolve to 'none' (sign-in button)
    // rather than leaving the background check pending forever.
    const controller = new AbortController()
    const abortTimer = setTimeout(() => controller.abort(), 8000)
    fetch('/api/chat/session', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { wallet?: string; isMod?: boolean } | null) => {
        if (sessionCheckId.current !== id) return
        const ok = j?.wallet === wanted
        setSession(ok ? 'ready' : 'none')
        setIsModUser(ok && Boolean(j?.isMod))
      })
      .catch(() => {
        if (sessionCheckId.current === id) setSession('none')
      })
      .finally(() => clearTimeout(abortTimer))
  }, [open, isConnected, address, session])

  const showError = useCallback((msg: string) => {
    setNotice(null)
    setError(msg)
    if (errorTimer.current) clearTimeout(errorTimer.current)
    errorTimer.current = setTimeout(() => setError(null), 4000)
  }, [])

  const showNotice = useCallback((msg: string) => {
    setError(null)
    setNotice(msg)
    if (errorTimer.current) clearTimeout(errorTimer.current)
    errorTimer.current = setTimeout(() => setNotice(null), 4000)
  }, [])

  const signIn = useCallback(async () => {
    if (!address || signing) return
    const signedFor = address.toLowerCase()
    const gen = ++signGen.current
    setSigning(true)
    // Watchdog: if the wallet never answers (popup suppressed, extension
    // closed), unstick the button so the user can retry without a refresh.
    // Generation-guarded so a late first attempt can't re-enable the button
    // mid-flight of a second one.
    watchdogRef.current = setTimeout(() => {
      if (signGen.current === gen) setSigning(false)
    }, 15_000)
    try {
      const timestamp = Math.floor(Date.now() / 1000)
      const signature = await signMessageAsync({
        message: loginMessage(signedFor, timestamp),
      })
      const res = await fetch('/api/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: signedFor, signature, timestamp }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null
        showError(j?.error ?? 'Sign-in failed')
        return
      }
      // Only accept if the wallet hasn't switched while the popup was open —
      // the cookie now belongs to `signedFor`, not necessarily the current
      // account. Bump the check id so a slow in-flight background check can't
      // clobber this fresh 'ready' back to 'none'.
      if (addressRef.current?.toLowerCase() === signedFor) {
        const j = (await res.json().catch(() => null)) as { isMod?: boolean } | null
        sessionCheckId.current++
        setSession('ready')
        setIsModUser(Boolean(j?.isMod))
      }
    } catch {
      // user rejected the signature — nothing to do
    } finally {
      if (watchdogRef.current) clearTimeout(watchdogRef.current)
      if (signGen.current === gen) setSigning(false)
    }
  }, [address, signing, signMessageAsync, showError])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || sending || !address) return
    setSending(true)

    // Optimistic: the message renders the instant Enter is hit (dimmed until
    // confirmed); the server verdict swaps in the real row or rolls it back.
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    // Monotonic timestamp: never earlier than the last message on screen, so
    // client clock skew can't slot the pending row mid-list. No cap slice on
    // the optimistic append — a failed send must not evict a real message.
    const lastTs = messages.length
      ? new Date(messages[messages.length - 1].created_at).getTime()
      : 0
    const temp: ChatMessage = {
      id: tempId,
      wallet: address.toLowerCase(),
      body: text,
      created_at: new Date(Math.max(Date.now(), lastTs + 1)).toISOString(),
    }
    setMessages((prev) => [...prev, temp])
    setInput('')
    atBottomRef.current = true

    const rollback = () => {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      // Give the text back for editing, but never clobber newer typing.
      setInput((cur) => (cur === '' ? text : cur))
    }

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      const j = (await res.json().catch(() => null)) as
        | { message?: ChatMessage; error?: string }
        | null
      if (!res.ok || !j?.message) {
        if (res.status === 401) setSession('none')
        rollback()
        showError(j?.error ?? 'Could not send')
        return
      }
      const real = j.message
      seenIds.current.add(real.id) // block the realtime echo of our own row
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId)
        if (withoutTemp.some((m) => m.id === real.id)) return withoutTemp // realtime beat us
        return [...withoutTemp, real].sort(byCreatedAt).slice(-200)
      })
    } catch {
      rollback()
      showError('Network error — try again')
    } finally {
      setSending(false)
    }
  }, [input, sending, address, messages, showError])

  const report = useCallback(
    async (id: string) => {
      if (reported.has(id)) return
      setReported((prev) => new Set(prev).add(id))
      try {
        const res = await fetch('/api/chat/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: id }),
        })
        if (!res.ok) {
          if (res.status === 401) setSession('none')
          // Un-flag so the user can retry instead of believing it reported.
          setReported((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        }
      } catch {
        setReported((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        showError('Network error — try again')
      }
    },
    [reported, showError]
  )

  const timeoutUser = useCallback(
    async (targetWallet: string, minutes: number) => {
      setTimeoutMenuId(null)
      const label = minutes === 1440 ? '24h' : minutes === 60 ? '1h' : `${minutes}m`
      try {
        const res = await fetch('/api/chat/timeout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet: targetWallet, minutes }),
        })
        const j = (await res.json().catch(() => null)) as { error?: string } | null
        if (!res.ok) {
          if (res.status === 401) setSession('none')
          showError(j?.error ?? 'Could not apply timeout')
          return
        }
        showNotice(`Timed out for ${label}`)
      } catch {
        showError('Network error — try again')
      }
    },
    [showError, showNotice]
  )

  const deleteOwn = useCallback(
    async (id: string) => {
      // Optimistic with verified rollback: drop locally right away; on
      // failure, only restore if the row is still visible per RLS (it may
      // have been auto-hidden or mod-deleted while our request was in flight).
      setConfirmingId(null)
      const target = messages.find((m) => m.id === id)
      setMessages((prev) => prev.filter((m) => m.id !== id))
      const restoreIfVisible = async () => {
        if (!target) return
        const { data } = await supabase
          .from('chat_messages')
          .select('id')
          .eq('id', id)
          .maybeSingle()
        if (data) {
          setMessages((prev) =>
            prev.some((m) => m.id === id) ? prev : [...prev, target].sort(byCreatedAt)
          )
        }
      }
      try {
        const res = await fetch('/api/chat/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: id }),
        })
        if (!res.ok) {
          if (res.status === 401) setSession('none')
          const j = (await res.json().catch(() => null)) as { error?: string } | null
          await restoreIfVisible()
          showError(j?.error ?? 'Could not delete')
        }
      } catch {
        await restoreIfVisible()
        showError('Network error — try again')
      }
    },
    [messages, showError]
  )

  if (!mounted || isMobile) return null

  const onListScroll = () => {
    const el = listRef.current
    if (!el) return
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      {!open && (
        <button style={styles.tab} onClick={() => setOpen(true)} aria-label="Open chat">
          <BubbleIcon />
          {unread > 0 && <span style={styles.badge}>{unread > 9 ? '9+' : unread}</span>}
        </button>
      )}

      <div style={{ ...styles.panel, top: panelTop, transform: open ? 'translateX(0)' : 'translateX(-105%)' }}>
        <div style={styles.header}>
          <span style={styles.title}>MineBean Chat</span>
          <button style={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close chat">
            <CloseIcon />
          </button>
        </div>

        <div ref={listRef} style={styles.list} onScroll={onListScroll}>
          {messages.length === 0 && <div style={styles.empty}>No messages yet. Say gm.</div>}
          {messages.map((m, i) => {
            const prev = messages[i - 1]
            const showHeader =
              !prev ||
              prev.wallet !== m.wallet ||
              new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > GROUP_GAP_MS
            const info = profiles.get(m.wallet.toLowerCase())
            const isOwn = Boolean(address && m.wallet === address.toLowerCase())
            const name = isOwn ? 'You' : resolve(m.wallet)
            return (
              <div
                key={m.id}
                style={{ ...styles.row, marginTop: showHeader ? 18 : 4 }}
                onMouseEnter={() => setHoveredId(m.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {showHeader && (
                  <div style={styles.msgHeader}>
                    {info?.pfpUrl ? (
                      <img src={info.pfpUrl} alt="" style={styles.pfp} />
                    ) : (
                      <div style={styles.pfpFallback}>{name.slice(0, 1).toUpperCase()}</div>
                    )}
                    {isOwn ? (
                      <span style={styles.youTag}>You</span>
                    ) : (
                      <span style={styles.name}>{name}</span>
                    )}
                    <span style={styles.time}>{fmtTime(m.created_at)}</span>
                  </div>
                )}
                <div style={styles.bodyLine}>
                  <span
                    style={{
                      ...styles.bodyText,
                      ...(m.id.startsWith('tmp-') ? { opacity: 0.55 } : {}),
                    }}
                  >
                    {m.body}
                  </span>
                  {session === 'ready' && !m.id.startsWith('tmp-') && (
                    confirmingId === m.id ? (
                      <span style={styles.confirmRow}>
                        <span style={styles.confirmText}>Delete message?</span>
                        <button style={styles.confirmYes} onClick={() => deleteOwn(m.id)}>
                          Yes
                        </button>
                        <button style={styles.confirmNo} onClick={() => setConfirmingId(null)}>
                          No
                        </button>
                      </span>
                    ) : timeoutMenuId === m.id ? (
                      <span style={styles.confirmRow}>
                        <span style={styles.confirmText}>Timeout:</span>
                        <button style={styles.confirmNo} onClick={() => timeoutUser(m.wallet, 5)}>
                          5m
                        </button>
                        <button style={styles.confirmNo} onClick={() => timeoutUser(m.wallet, 60)}>
                          1h
                        </button>
                        <button style={styles.confirmYes} onClick={() => timeoutUser(m.wallet, 1440)}>
                          24h
                        </button>
                        <button style={styles.confirmNo} onClick={() => setTimeoutMenuId(null)}>
                          X
                        </button>
                      </span>
                    ) : (
                      <span style={styles.actions}>
                        {!isOwn && (hoveredId === m.id || reported.has(m.id)) && (
                          <button
                            style={styles.reportBtn}
                            onClick={() => report(m.id)}
                            title={reported.has(m.id) ? 'Reported' : 'Report message'}
                            aria-label="Report message"
                          >
                            <FlagIcon active={reported.has(m.id)} />
                          </button>
                        )}
                        {(isOwn || isModUser) && hoveredId === m.id && (
                          <button
                            style={styles.reportBtn}
                            onClick={() => {
                              setTimeoutMenuId(null)
                              setConfirmingId(m.id)
                            }}
                            title={isOwn ? 'Delete message' : 'Delete message (mod)'}
                            aria-label="Delete message"
                          >
                            <TrashIcon />
                          </button>
                        )}
                        {isModUser && !isOwn && hoveredId === m.id && (
                          <button
                            style={styles.reportBtn}
                            onClick={() => {
                              setConfirmingId(null)
                              setTimeoutMenuId(m.id)
                            }}
                            title="Timeout user"
                            aria-label="Timeout user"
                          >
                            <ClockIcon />
                          </button>
                        )}
                      </span>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {notice && <div style={styles.notice}>{notice}</div>}

        <div style={styles.inputArea}>
          {!isConnected ? (
            <div style={styles.pillDisabled}>Connect wallet to chat...</div>
          ) : session !== 'ready' ? (
            // Never a blocking "loading" state: the button is clickable from the
            // first paint. The background cookie check merely skips the
            // signature when a valid session already exists.
            <button style={styles.signInBtn} onClick={signIn} disabled={signing}>
              {signing ? 'Check your wallet...' : 'Sign in to chat'}
            </button>
          ) : (
            <div style={styles.pill}>
              <textarea
                style={styles.textarea}
                value={input}
                placeholder="Message..."
                maxLength={MAX_LENGTH}
                rows={1}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
              />
              {input.length > MAX_LENGTH - 100 && (
                <span style={styles.charCount}>{input.length}/{MAX_LENGTH}</span>
              )}
              <button
                style={styles.sendBtn}
                onClick={send}
                disabled={!input.trim() || sending}
                aria-label="Send message"
              >
                <SendIcon dim={!input.trim() || sending} />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  // Sits directly below the leaderboard tab (top: 160) on the left edge.
  tab: { position: 'fixed', left: 0, top: 232, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.5)', borderLeft: 'none', borderRadius: '0 10px 10px 0', padding: '14px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  badge: { position: 'absolute', top: 6, right: 4, minWidth: 16, height: 16, borderRadius: 8, background: '#fff', color: '#0a0a0a', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', fontFamily: "'Inter', -apple-system, sans-serif" },
  // Starts below the nav bar (top is measured live from the <header> element).
  // Glass: translucent site-base + backdrop blur, so the body's ambient blue
  // gradients show through and the panel matches the page by construction.
  // Above HelpButton (1000), below modals (2000).
  panel: { position: 'fixed', left: 0, bottom: 0, width: 360, maxWidth: '86vw', background: 'linear-gradient(180deg, rgba(0,82,255,0.06), rgba(8,11,20,0) 220px), rgba(8,11,20,0.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', zIndex: 1100, transition: 'transform 0.3s ease', fontFamily: "'Inter', -apple-system, sans-serif" },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 },
  title: { fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: 0.2 },
  closeBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', padding: 4, display: 'flex' },
  list: { flex: 1, overflowY: 'auto', padding: '6px 18px 16px' },
  empty: { color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', marginTop: 36 },
  row: { display: 'flex', flexDirection: 'column' },
  msgHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 },
  pfp: { width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  pfpFallback: { width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  name: { fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)' },
  youTag: { fontSize: 11, fontWeight: 700, color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, padding: '1px 8px 2px', background: 'rgba(255,255,255,0.06)', letterSpacing: 0.3 },
  time: { fontSize: 11, color: 'rgba(255,255,255,0.28)', marginLeft: 'auto' },
  bodyLine: { display: 'flex', alignItems: 'flex-start', gap: 8, paddingLeft: 36 },
  bodyText: { fontSize: 14, color: '#F2F2F2', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', flex: 1 },
  reportBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 2, flexShrink: 0, marginTop: 2, display: 'flex' },
  confirmRow: { display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  confirmText: { fontSize: 11, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap' },
  confirmYes: { background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.45)', borderRadius: 6, color: '#ff6b6b', fontSize: 11, fontWeight: 600, padding: '2px 9px', cursor: 'pointer' },
  confirmNo: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, padding: '2px 9px', cursor: 'pointer' },
  error: { padding: '8px 18px', fontSize: 12, color: '#ff6b6b', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 },
  notice: { padding: '8px 18px', fontSize: 12, color: 'rgba(255,255,255,0.65)', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 },
  actions: { display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  inputArea: { padding: '12px 16px 16px', flexShrink: 0 },
  pill: { display: 'flex', alignItems: 'flex-end', gap: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, padding: '5px 6px 5px 16px', position: 'relative' },
  pillDisabled: { padding: '12px 16px', borderRadius: 22, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.32)', fontSize: 13 },
  signInBtn: { width: '100%', padding: '12px 16px', borderRadius: 22, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  textarea: { flex: 1, resize: 'none', background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 13.5, fontFamily: 'inherit', lineHeight: 1.45, maxHeight: 96, overflowY: 'auto', padding: '6px 0' },
  charCount: { position: 'absolute', right: 54, top: -18, fontSize: 10, color: 'rgba(255,255,255,0.35)' },
  sendBtn: { background: 'none', border: 'none', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
}
