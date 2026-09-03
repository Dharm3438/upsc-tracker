import { Suspense, lazy, useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'

import { getApiKey, UNAUTHORIZED_EVENT } from '@/api/client'
import { Unlock } from '@/components/Unlock'
import { AppLayout } from '@/components/shell/AppLayout'
import { FocusLayout } from '@/components/shell/FocusLayout'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { AnswerDetail } from '@/screens/AnswerDetail'
import { AnswerTimer } from '@/screens/AnswerTimer'
import { NodeDetail } from '@/screens/NodeDetail'
import { NotFound } from '@/screens/NotFound'
import { Notes } from '@/screens/Notes'
import { Practice } from '@/screens/Practice'
import { Settings } from '@/screens/Settings'
import { Syllabus } from '@/screens/Syllabus'
import { TestDetail } from '@/screens/TestDetail'
import { Today } from '@/screens/Today'

// Recharts is most of the JavaScript in this app and only the Progress screen
// uses it. Splitting that screen out keeps the three-times-a-day screens —
// Today above all — from paying for a chart they never draw.
const Progress = lazy(() =>
  import('@/screens/Progress').then((module) => ({ default: module.Progress })),
)

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
    <Suspense fallback={<SkeletonRows rows={5} />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Today />} />
          <Route path="syllabus" element={<Syllabus />}>
            <Route path="node/:nodeId" element={<NodeDetail />} />
          </Route>
          <Route path="practice" element={<Practice />} />
          <Route path="practice/tests/:testId" element={<TestDetail />} />
          <Route path="practice/answers/:answerId" element={<AnswerDetail />} />
          <Route path="notes" element={<Notes />} />
          <Route path="progress" element={<Progress />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* The timer runs without the shell around it. */}
        <Route element={<FocusLayout />}>
          <Route path="practice/answers/new" element={<AnswerTimer />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
