import { useState, useEffect } from 'react'

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&$@*/<>'

export function useScrambleText(target: string, intervalMs = 45): string {
  const [text, setText] = useState(target)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setText(target)
      return
    }

    let frame = 0
    const id = setInterval(() => {
      frame++
      const revealed = Math.floor(frame / 1.6)
      const out = target
        .split('')
        .map((c, i) => {
          if (c === ' ') return ' '
          if (i < revealed) return c
          return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        })
        .join('')
      setText(out)
      if (revealed >= target.length) {
        clearInterval(id)
        setText(target)
      }
    }, intervalMs)

    return () => clearInterval(id)
  }, [target, intervalMs])

  return text
}
