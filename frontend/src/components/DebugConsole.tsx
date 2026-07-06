import { useEffect, useState } from 'react'
import eruda from 'eruda'

export function DebugConsole() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // Activate via ?debug=true query param, or shake gesture (optional)
    const params = new URLSearchParams(window.location.search)
    if (params.get('debug') === 'true') {
      eruda.init()
      setLoaded(true)
    }
  }, [])

  if (!loaded) return null

  return null // eruda renders its own floating UI
}
