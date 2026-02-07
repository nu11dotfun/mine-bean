'use client'

import { createContext, useContext, useEffect, useRef, useCallback, ReactNode } from 'react'
import { API_BASE } from './api'

type EventCallback = (data: unknown) => void

interface SSEContextValue {
    subscribeGlobal: (event: string, callback: EventCallback) => () => void
    subscribeUser: (event: string, callback: EventCallback) => () => void
}

const SSEContext = createContext<SSEContextValue | null>(null)

const GLOBAL_EVENTS = ['gameStarted', 'deployed', 'roundSettled']
const USER_EVENTS = ['autoMineExecuted', 'configDeactivated', 'stopped', 'claimedBNB', 'claimedBEAN', 'checkpointed']

export function SSEProvider({
    children,
    userAddress
}: {
    children: ReactNode
    userAddress?: string
}) {
    const globalListeners = useRef<Map<string, Set<EventCallback>>>(new Map())
    const userListeners = useRef<Map<string, Set<EventCallback>>>(new Map())
    const globalSource = useRef<EventSource | null>(null)
    const userSource = useRef<EventSource | null>(null)

    // ONE global connection
    useEffect(() => {
        const source = new EventSource(`${API_BASE}/api/events/rounds`)
        globalSource.current = source

        GLOBAL_EVENTS.forEach(event => {
            source.addEventListener(event, (e: MessageEvent) => {
                try {
                    const data = JSON.parse(e.data)
                    globalListeners.current.get(event)?.forEach(cb => cb(data))
                } catch {
                    globalListeners.current.get(event)?.forEach(cb => cb(e.data))
                }
            })
        })

        source.onerror = () => {
            console.warn('[SSE] Global connection error, will auto-reconnect')
        }

        return () => {
            source.close()
            globalSource.current = null
        }
    }, [])

    // ONE user connection (when wallet connected)
    useEffect(() => {
        if (!userAddress) {
            userSource.current?.close()
            userSource.current = null
            return
        }

        const source = new EventSource(`${API_BASE}/api/user/${userAddress}/events`)
        userSource.current = source

        USER_EVENTS.forEach(event => {
            source.addEventListener(event, (e: MessageEvent) => {
                try {
                    const data = JSON.parse(e.data)
                    userListeners.current.get(event)?.forEach(cb => cb(data))
                } catch {
                    userListeners.current.get(event)?.forEach(cb => cb(e.data))
                }
            })
        })

        source.onerror = () => {
            console.warn('[SSE] User connection error, will auto-reconnect')
        }

        return () => {
            source.close()
            userSource.current = null
        }
    }, [userAddress])

    const subscribeGlobal = useCallback((event: string, callback: EventCallback) => {
        if (!globalListeners.current.has(event)) {
            globalListeners.current.set(event, new Set())
        }
        globalListeners.current.get(event)!.add(callback)

        return () => {
            globalListeners.current.get(event)?.delete(callback)
        }
    }, [])

    const subscribeUser = useCallback((event: string, callback: EventCallback) => {
        if (!userListeners.current.has(event)) {
            userListeners.current.set(event, new Set())
        }
        userListeners.current.get(event)!.add(callback)

        return () => {
            userListeners.current.get(event)?.delete(callback)
        }
    }, [])

    return (
        <SSEContext.Provider value={{ subscribeGlobal, subscribeUser }}>
            {children}
        </SSEContext.Provider>
    )
}

export function useSSE() {
    const context = useContext(SSEContext)
    if (!context) throw new Error('useSSE must be used within SSEProvider')
    return context
}
