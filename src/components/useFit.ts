import { useCallback, useLayoutEffect, useState } from 'react'

/** Board height ≈ 1.365 × width (5×5 grid of 5:7 cells + gaps). */
export const BOARD_RATIO = 1.365

/** Largest width that fits the element's box at the given height/width ratio. */
export function useFitWidth<T extends HTMLElement>(ratio = BOARD_RATIO, max = 640) {
  const [el, setEl] = useState<T | null>(null)
  const ref = useCallback((node: T | null) => setEl(node), [])
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    if (!el) return
    const measure = () => {
      const { width: w, height: h } = el.getBoundingClientRect()
      setWidth(Math.max(120, Math.floor(Math.min(w, h / ratio, max))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [el, ratio, max])
  return { ref, width }
}
