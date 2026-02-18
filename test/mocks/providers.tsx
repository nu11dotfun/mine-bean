import React, { ReactNode } from 'react'

/**
 * Lightweight test wrapper. Most component tests should mock useSSE and useUserData
 * at the module level rather than wrapping in real providers. Use this only for
 * integration-level context tests.
 */
export function TestWrapper({ children }: { children: ReactNode }) {
  return <>{children}</>
}
