import type { CSSProperties } from 'react';
import './SidebarSnowfall.css';

interface Snowflake {
  id: number;
  glyph: string;
  color: string;
  left: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  opacity: number;
  rotation: number;
  glow: boolean;
}

const SNOWFLAKE_COUNT = 16;

// Real snowflake glyphs (six-pointed crystals), not plain dots.
const GLYPHS = ['❄', '❅', '❆'];

// Ice Blue palette -- see CLAUDE.md task spec: Ice Blue, Frost Blue, Glacial
// Blue, Snow White, Cool Blue.
const COLORS = ['#BFEFFF', '#D9F6FF', '#A7DFF2', '#F4FCFF', '#8ED8F0'];

// A small deterministic PRNG (not Math.random) so the layout is stable across
// re-renders -- this module evaluates once, so the values never change, but
// using Math.random() at module scope would still re-seed on hot reload and
// make it look like the snowflakes "jump".
function makeSnowflakes(count: number): Snowflake[] {
  let seed = 1337;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return Array.from({ length: count }, (_, id) => ({
    id,
    glyph: GLYPHS[Math.floor(rand() * GLYPHS.length)],
    color: COLORS[Math.floor(rand() * COLORS.length)],
    left: rand() * 100,
    size: 7 + rand() * 7,
    duration: 10 + rand() * 12,
    delay: -rand() * 20,
    drift: (rand() - 0.5) * 50,
    opacity: 0.3 + rand() * 0.45,
    rotation: rand() * 360 * (rand() > 0.5 ? 1 : -1),
    glow: rand() > 0.72,
  }));
}

const SNOWFLAKES = makeSnowflakes(SNOWFLAKE_COUNT);

// Purely decorative Ice Blue snowfall confined to the dock pill. Sits behind
// the nav buttons (negative z-index within .sidebar__dock's own stacking
// context -- see SidebarSnowfall.css) so it never competes with navigation
// for clicks or focus.
function SidebarSnowfall() {
  return (
    <div className="sidebar__snowfall" aria-hidden="true">
      {SNOWFLAKES.map((flake) => (
        <span
          key={flake.id}
          className={`sidebar__snowflake${flake.glow ? ' sidebar__snowflake--glow' : ''}`}
          style={
            {
              left: `${flake.left}%`,
              fontSize: `${flake.size}px`,
              color: flake.color,
              animationDuration: `${flake.duration}s`,
              animationDelay: `${flake.delay}s`,
              '--snowflake-drift': `${flake.drift}px`,
              '--snowflake-rotation': `${flake.rotation}deg`,
              '--snowflake-opacity': flake.opacity,
              '--snowflake-glow-color': flake.color,
            } as CSSProperties
          }
        >
          {flake.glyph}
        </span>
      ))}
    </div>
  );
}

export default SidebarSnowfall;
