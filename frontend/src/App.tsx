import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'

import { getApiKey, UNAUTHORIZED_EVENT } from '@/api/client'
import { Unlock } from '@/components/Unlock'
import { TabBar } from '@/components/shell/TabBar'
import { Placeholder } from '@/screens/Placeholder'
import { NodeDetail } from '@/screens/NodeDetail'
import { Syllabus } from '@/screens/Syllabus'
import { Today } from '@/screens/Today'

export function App() {
  const [unlocked, setUnlocked] = useState(() => getApiKey() !== null)

  useEffect(() => {
    // The client clears the key on a 401; the shell reacts by locking again.
    const lock = () => setUnlocked(false)
    window.addEventListener(UNAUTHORIZED_EVENT, lock)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, lock)
  }, [])

  if (!unlocked) return <Unlock onUnlocked={() => setUnlocked(true)} />

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-tap">
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/syllabus" element={<Syllabus />} />
        <Route path="/syllabus/node/:nodeId" element={<NodeDetail />} />
        <Route path="/practice" element={<Placeholder title="Practice" phase="phases 4 and 5" />} />
        <Route path="/notes" element={<Placeholder title="Notes" phase="phases 4 and 6" />} />
        <Route path="/progress" element={<Placeholder title="Progress" phase="phase 7" />} />
        <Route path="*" element={<Placeholder title="Not found" phase="a later phase" />} />
      </Routes>
      <TabBar />
    </div>
  )
}
