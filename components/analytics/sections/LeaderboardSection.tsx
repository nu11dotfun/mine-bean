'use client'

import React from 'react'
import LeaderboardTable from '@/components/LeaderboardTable'

// Top miners, stakers and unroasted-BEAN holders. LeaderboardTable brings its
// own tabs, heading and mobile handling.
export default function LeaderboardSection() {
  return <LeaderboardTable />
}
