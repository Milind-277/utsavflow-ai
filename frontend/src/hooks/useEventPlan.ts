import { useState, useEffect, useCallback } from 'react'
import type { EventPlan } from '@/types'
import { loadEventPlan, saveEventPlan, clearEventPlan } from '@/lib/storage'
import { createDemoPlan } from '@/lib/demoData'

export function useEventPlan() {
  const [plan, setPlan] = useState<EventPlan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const result = loadEventPlan()
    if (result.ok) {
      setPlan(result.plan)
    } else {
      setPlan(null)
    }
    setLoading(false)
  }, [])

  const save = useCallback((newPlan: EventPlan) => {
    saveEventPlan(newPlan)
    setPlan(newPlan)
  }, [])

  const loadDemo = useCallback(() => {
    const demo = createDemoPlan()
    saveEventPlan(demo)
    setPlan(demo)
  }, [])

  const clear = useCallback(() => {
    clearEventPlan()
    setPlan(null)
  }, [])

  const toggleTask = useCallback((taskId: string) => {
    setPlan((prev) => {
      if (!prev) return null
      const updatedTasks = prev.timeline.map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      )
      const updatedPlan: EventPlan = {
        ...prev,
        timeline: updatedTasks,
        updatedAt: new Date().toISOString(),
      }
      saveEventPlan(updatedPlan)
      return updatedPlan
    })
  }, [])

  const isDemo = Boolean(plan?.id.startsWith('demo-') || plan?.name.includes('[DEMO]'))

  return {
    plan,
    loading,
    isDemo,
    save,
    loadDemo,
    clear,
    toggleTask,
  }
}
