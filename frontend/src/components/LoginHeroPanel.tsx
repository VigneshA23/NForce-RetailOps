import { useRef, useEffect, useState, useCallback } from 'react'
import { motion } from 'motion/react'
import {
  Bell, Calendar, CalendarCheck, CheckSquare, Clock, ClipboardCheck,
  ListChecks, ShieldCheck, ShoppingCart, Store, Users, Users2,
} from 'lucide-react'
import './LoginHeroPanel.css'

const TASKS = ['Wipe tables', 'Restock napkins', 'Check fridges', 'Lock safe']

const METRIC_TILES = ['Multi-store ready', "Today's checklist", 'All stores synced']

const DUST_POSITIONS: React.CSSProperties[] = [
  { left: '9%', top: '88%', width: 3, height: 3, animationDuration: '22s', animationDelay: '0s' },
  { left: '17%', top: '96%', width: 2, height: 2, animationDuration: '26s', animationDelay: '3s' },
  { left: '26%', top: '82%', width: 2, height: 2, animationDuration: '30s', animationDelay: '6s' },
  { left: '34%', top: '94%', width: 3, height: 3, animationDuration: '24s', animationDelay: '9s' },
  { left: '43%', top: '78%', width: 2, height: 2, animationDuration: '28s', animationDelay: '1.5s' },
  { left: '52%', top: '92%', width: 2.5, height: 2.5, animationDuration: '32s', animationDelay: '12s' },
  { left: '61%', top: '86%', width: 2, height: 2, animationDuration: '25s', animationDelay: '4.5s' },
  { left: '69%', top: '97%', width: 3, height: 3, animationDuration: '29s', animationDelay: '7.5s' },
  { left: '78%', top: '84%', width: 2, height: 2, animationDuration: '27s', animationDelay: '10.5s' },
  { left: '86%', top: '93%', width: 2.5, height: 2.5, animationDuration: '33s', animationDelay: '2.5s' },
  { left: '93%', top: '80%', width: 2, height: 2, animationDuration: '23s', animationDelay: '14s' },
  { left: '5%', top: '60%', width: 2, height: 2, animationDuration: '31s', animationDelay: '16s' },
  { left: '48%', top: '58%', width: 2, height: 2, animationDuration: '35s', animationDelay: '18s' },
  { left: '88%', top: '62%', width: 2, height: 2, animationDuration: '30s', animationDelay: '20s' },
]

const CLOCK_MARKS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
  const inner = i % 3 === 0 ? 40 : 43
  return {
    x1: (50 + Math.cos(angle) * inner).toFixed(2),
    y1: (50 + Math.sin(angle) * inner).toFixed(2),
    x2: (50 + Math.cos(angle) * 47).toFixed(2),
    y2: (50 + Math.sin(angle) * 47).toFixed(2),
  }
})

export default function LoginHeroPanel() {
  const paralRafRef = useRef(0)
  const frontLayerRef = useRef<HTMLDivElement>(null)
  const midLayerRef = useRef<HTMLDivElement>(null)
  const backLayerRef = useRef<HTMLDivElement>(null)

  const [checkedCount, setCheckedCount] = useState(0)
  const [cycle, setCycle] = useState(0)

  const reducedMotion = useRef(
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  // Checklist ticker loop
  useEffect(() => {
    if (reducedMotion.current) {
      setCheckedCount(4)
      return
    }
    let count = 0
    let tid: ReturnType<typeof setTimeout>

    function tick() {
      count = count >= 4 ? 0 : count + 1
      if (count === 0) setCycle(c => c + 1)
      setCheckedCount(count)
      const delay = count === 0 ? 500 : count === 4 ? 2200 : 920
      tid = setTimeout(tick, delay)
    }

    tid = setTimeout(tick, 1400)
    return () => clearTimeout(tid)
  }, [])

  // Parallax — RAF, writes directly to style.transform on 3 layers
  const onPanelMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion.current) return
    cancelAnimationFrame(paralRafRef.current)
    const rect = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    paralRafRef.current = requestAnimationFrame(() => {
      if (frontLayerRef.current) {
        frontLayerRef.current.style.transition = 'none'
        frontLayerRef.current.style.transform = `translate(${(px * 14).toFixed(1)}px, ${(py * 9).toFixed(1)}px)`
      }
      if (midLayerRef.current) {
        midLayerRef.current.style.transition = 'none'
        midLayerRef.current.style.transform = `translate(${(px * 8).toFixed(1)}px, ${(py * 5).toFixed(1)}px)`
      }
      if (backLayerRef.current) {
        backLayerRef.current.style.transition = 'none'
        backLayerRef.current.style.transform = `translate(${(px * 4).toFixed(1)}px, ${(py * 2.5).toFixed(1)}px)`
      }
    })
  }, [])

  const onPanelMouseLeave = useCallback(() => {
    cancelAnimationFrame(paralRafRef.current)
    const ease = 'transform 0.55s cubic-bezier(.16,.84,.3,1)'
    if (frontLayerRef.current) {
      frontLayerRef.current.style.transition = ease
      frontLayerRef.current.style.transform = ''
    }
    if (midLayerRef.current) {
      midLayerRef.current.style.transition = ease
      midLayerRef.current.style.transform = ''
    }
    if (backLayerRef.current) {
      backLayerRef.current.style.transition = ease
      backLayerRef.current.style.transform = ''
    }
  }, [])

  useEffect(() => () => cancelAnimationFrame(paralRafRef.current), [])

  return (
    <div
      className="lhp__panel"
      onMouseMove={onPanelMouseMove}
      onMouseLeave={onPanelMouseLeave}
      aria-hidden="true"
    >
      <div className="lhp__grain" />

      <div className="lhp__aurora">
        <div className="lhp__aurora-a" />
        <div className="lhp__aurora-b" />
        <div className="lhp__aurora-c" />
      </div>

      <div className="lhp__dust-layer">
        {DUST_POSITIONS.map((pos, i) => (
          <div
            key={i}
            className="lhp__dust"
            style={{
              ...pos,
              background: `rgba(255,255,255,${0.45 + (i % 4) * 0.08})`,
              borderRadius: '50%',
            }}
          />
        ))}
      </div>

      <div className="lhp__radial-light" />
      <div className="lhp__vignette" />

      {/* Orbit + phone center */}
      <div className="lhp__orbit-container">
        {/* Atmospheric clock SVG */}
        <svg className="lhp__clock" viewBox="0 0 100 100" fill="none" aria-hidden="true">
          <circle cx="50" cy="50" r="48" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
          {CLOCK_MARKS.map((m, i) => (
            <line
              key={i}
              x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2}
              strokeWidth={i % 3 === 0 ? 0.9 : 0.45}
              stroke="rgba(255,255,255,0.35)"
            />
          ))}
          {/* Hour hand */}
          <line x1="50" y1="50" x2="30" y2="50" stroke="rgba(255,255,255,0.28)" strokeWidth="1.6" strokeLinecap="round" />
          {/* Minute hand */}
          <line x1="50" y1="50" x2="50" y2="22" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeLinecap="round" />
          {/* Second hand */}
          <line x1="50" y1="50" x2="50" y2="15" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" strokeLinecap="round" />
          <circle cx="50" cy="50" r="1.8" fill="rgba(255,255,255,0.4)" />
        </svg>

        <div className="lhp__orbit-ring" />
        <div className="lhp__pulse-glow" />

        {/* Phone mockup */}
        <div className="lhp__phone">
          <div className="lhp__phone-inner">
            {/* Stripe bar */}
            <div className="lhp__phone-stripes">
              {[1, 2, 3, 4, 5, 6, 7].map(n => (
                <div key={n} className={n % 2 === 1 ? 'lhp__stripe lhp__stripe--red' : 'lhp__stripe lhp__stripe--white'} />
              ))}
            </div>

            {/* Content */}
            <div className="lhp__phone-content">
              <div className="lhp__phone-header">Today's Tasks</div>
              {TASKS.map((task, i) => (
                <div key={i} className="lhp__task-row">
                  <svg className="lhp__checkbox" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle
                      cx="10" cy="10" r="8"
                      stroke={checkedCount > i ? '#0E9AA0' : 'rgba(255,255,255,0.4)'}
                      strokeWidth="1.5"
                    />
                    {checkedCount > i && (
                      <path
                        key={`tick-${cycle}-${i}`}
                        d="M5.5 10.5l3 3 6-6"
                        stroke="#0E9AA0"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="12"
                        strokeDashoffset="12"
                        className="lhp__tick-path"
                      />
                    )}
                  </svg>
                  <span className={`lhp__task-label${checkedCount > i ? ' lhp__task-label--done' : ''}`}>
                    {task}
                  </span>
                </div>
              ))}
              {checkedCount === 4 && (
                <div className="lhp__all-done">All Done</div>
              )}
            </div>

            <div className="lhp__phone-home" />
          </div>
        </div>

        {/* Back parallax layer — least movement */}
        <div ref={backLayerRef} className="lhp__layer">
          <div className="lhp__icon lhp__icon--glass lhp__icon--circle lhp__drift-a" style={{ left: '73%', top: '36%', width: '7.5%' }}>
            <Users size="54%" />
          </div>
          <div className="lhp__icon lhp__icon--glass lhp__icon--circle lhp__drift-b" style={{ left: '72%', top: '70%', width: '8%' }}>
            <Clock size="52%" />
          </div>
          <div className="lhp__icon lhp__icon--glass lhp__icon--rounded lhp__drift-c" style={{ left: '22%', top: '74%', width: '9.5%' }}>
            <Users2 size="52%" />
          </div>
          <div className="lhp__icon lhp__icon--glass lhp__icon--circle lhp__drift-a" style={{ left: '26%', top: '8%', width: '8%', animationDelay: '0.8s' }}>
            <Calendar size="50%" />
          </div>
        </div>

        {/* Mid parallax layer */}
        <div ref={midLayerRef} className="lhp__layer">
          <div className="lhp__icon lhp__icon--glass lhp__icon--rounded lhp__float" style={{ left: '41%', top: '4%', width: '9.5%', animationDuration: '8s', animationDelay: '1.2s' }}>
            <ListChecks size="50%" />
          </div>
          <div className="lhp__icon lhp__icon--glass lhp__icon--circle lhp__float" style={{ left: '68%', top: '9%', width: '9%', animationDuration: '9.5s', animationDelay: '2.1s' }}>
            <Bell size="50%" />
          </div>
          <div className="lhp__icon lhp__icon--label lhp__float" style={{ left: '77%', top: '46%', animationDuration: '12s', animationDelay: '3s' }}>
            Store
          </div>
          <div className="lhp__icon lhp__icon--glass lhp__icon--circle lhp__float lhp__icon--dollar" style={{ left: '7%', top: '70%', width: '8.5%', animationDuration: '8.2s', animationDelay: '1.1s' }}>
            $
          </div>
          <div className="lhp__icon lhp__icon--glass lhp__icon--circle lhp__float" style={{ left: '45%', top: '88%', width: '9%', animationDuration: '10.8s', animationDelay: '3.4s' }}>
            <ShoppingCart size="50%" />
          </div>
          <div className="lhp__icon lhp__icon--glass lhp__icon--rounded lhp__float" style={{ left: '14%', top: '29%', width: '9%', animationDuration: '10.5s', animationDelay: '2.6s' }}>
            <CalendarCheck size="50%" />
          </div>
        </div>

        {/* Front parallax layer — most movement */}
        <div ref={frontLayerRef} className="lhp__layer">
          <div className="lhp__icon lhp__icon--solid-white lhp__icon--rounded lhp__float" style={{ left: '6%', top: '15%', width: '11%', animationDuration: '7s', animationDelay: '0s' }}>
            <Store size="48%" />
          </div>
          <div className="lhp__icon lhp__icon--solid-gold lhp__icon--rounded lhp__float" style={{ left: '74%', top: '22%', width: '10%', animationDuration: '9s', animationDelay: '0.6s' }}>
            <ShieldCheck size="48%" />
          </div>
          <div className="lhp__icon lhp__icon--solid-white lhp__icon--circle lhp__float" style={{ left: '76%', top: '56%', width: '10%', animationDuration: '7.5s', animationDelay: '1.8s' }}>
            <ClipboardCheck size="50%" />
          </div>
          <div className="lhp__icon lhp__icon--solid-white lhp__icon--rounded lhp__float" style={{ left: '3%', top: '44%', width: '12%', animationDuration: '8.5s', animationDelay: '0.3s' }}>
            <CheckSquare size="50%" />
          </div>
        </div>
      </div>

      {/* Metric tiles */}
      <div className="lhp__metric-tiles">
        {METRIC_TILES.map((tile, i) => (
          <motion.div
            key={tile}
            className="lhp__metric-tile"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + i * 0.2, duration: 0.55, ease: [0.16, 0.84, 0.3, 1] }}
          >
            <span className="lhp__metric-dot" />
            {tile}
          </motion.div>
        ))}
      </div>

      {/* Tagline */}
      <div className="lhp__tagline-wrap">
        <p className="lhp__tagline">Your stores. One checklist.</p>
        <p className="lhp__tagline-sub">
          Run daily checklists, audits, and store ops — from one place.
        </p>
      </div>
    </div>
  )
}
