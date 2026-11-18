import { useCallback, type ReactNode } from 'react'
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from 'motion/react'
import LoginHeroPanel from './LoginHeroPanel'
import '../pages/LoginCrimson.css'

// The Ked's sign-in frame: illustrated hero on the left, the tilting white card
// with the Ked's logo on the right. Login.tsx draws the same frame inline; the
// password pages (set up / reset via email link, forced change after a
// temporary password) use this so they read as the same screen.
function KedsAuthCard({ children }: { children: ReactNode }) {
  const prefersReducedMotion = useReducedMotion()
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useTransform(mouseY, [-200, 200], [3, -3])
  const rotateY = useTransform(mouseX, [-200, 200], [-3, 3])

  const onCardMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (prefersReducedMotion) return
      const rect = e.currentTarget.getBoundingClientRect()
      mouseX.set(e.clientX - rect.left - rect.width / 2)
      mouseY.set(e.clientY - rect.top - rect.height / 2)
    },
    [prefersReducedMotion, mouseX, mouseY],
  )

  const onCardMouseLeave = useCallback(() => {
    animate(mouseX, 0, { type: 'spring', stiffness: 260, damping: 28 })
    animate(mouseY, 0, { type: 'spring', stiffness: 260, damping: 28 })
  }, [mouseX, mouseY])

  return (
    <div className="login3-shell">
      <div className="login3-bg-overlay" aria-hidden="true" />

      <div className="login3-grid">
        <div className="login3-hero login3-hero--illustrated">
          <LoginHeroPanel />
        </div>

        <div className="login3-panel">
          <div className="nf1-card-wrap" style={{ perspective: '1200px' }}>
            <motion.div
              className="nf1-tilt-wrapper"
              style={!prefersReducedMotion ? { rotateX, rotateY } : undefined}
              onMouseMove={onCardMouseMove}
              onMouseLeave={onCardMouseLeave}
              whileHover={!prefersReducedMotion ? { z: 4 } : undefined}
            >
              {!prefersReducedMotion && (
                <motion.div
                  className="nf1-card-glow"
                  animate={{ opacity: [0.35, 0.75, 0.35] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  aria-hidden="true"
                />
              )}

              <motion.div
                className="login3-panel-inner"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 0.84, 0.3, 1] }}
              >
                <div className="nf1-card-highlight" aria-hidden="true" />

                <div className="login3-mobile-brand login3-mobile-brand--keds">
                  <img
                    src="/keds-logo.png"
                    alt="Ked's Ice Cream, Waffles & Crepes"
                    className="login3-mobile-logo login3-mobile-logo--keds"
                  />
                </div>

                <div className="nf1-card-header nf1-card-header--keds">
                  <img
                    src="/keds-logo.png"
                    alt="Ked's Ice Cream, Waffles & Crepes"
                    className="nf1-card-logo nf1-card-logo--keds"
                  />
                </div>

                {children}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default KedsAuthCard
