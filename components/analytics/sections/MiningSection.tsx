'use client'

import React from 'react'
import MiningTable from '@/components/MiningTable'

// The round-by-round mining history and Beanpot hits, restored as its own
// section (MiningTable brings its own Rounds / Beanpot tabs and columns).
export default function MiningSection() {
  return <MiningTable />
}
