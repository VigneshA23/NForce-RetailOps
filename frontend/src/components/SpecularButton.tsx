import { forwardRef, useRef, useEffect, type AriaAttributes, type CSSProperties, type ReactNode, type MouseEventHandler } from 'react';
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl';
import './SpecularButton.css';

type ButtonSize = 'sm' | 'md' | 'lg';

export interface SpecularButtonProps {
  children?: ReactNode;
  size?: ButtonSize;
  radius?: number;
  tint?: string;
  tintOpacity?: number;
  blur?: number;
  textColor?: string;
  lineColor?: string;
  baseColor?: string;
  intensity?: number;
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  glow?: number;
  speed?: number;
  followMouse?: boolean;
  proximity?: number;
  autoAnimate?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
  'aria-expanded'?: AriaAttributes['aria-expanded'];
  'aria-haspopup'?: AriaAttributes['aria-haspopup'];
}

interface ShaderProps {
  radius: number;
  lineColor: string;
  baseColor: string;
  intensity: number;
  shineSize: number;
  shineFade: number;
  thickness: number;
  glow: number;
  speed: number;
  followMouse: boolean;
  proximity: number;
  autoAnimate: boolean;
}

const PAD = 20;

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uPx;
uniform float uSpot;
uniform vec2 uEntry;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uGlow;

out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float shapeSDF(vec2 p) { return sdRoundedRect(p, uHalfSize, uRadius); }

// Parameterizes the whole rounded-rect border as a single looped coordinate
// in [0, 1), so the highlight can travel continuously around every edge and
// corner instead of only brightening whichever side faces the light.
float loopPosition(vec2 p, vec2 b, float r) {
  vec2 inner = b - r;
  float arc = 1.5707963 * r;
  float quarter = inner.x + inner.y + arc;
  vec2 a = abs(p);
  vec2 q = a - inner;
  float s = q.x > 0.0 && q.y > 0.0
    ? inner.y + atan(q.y, q.x) * r
    : (q.x > q.y ? min(a.y, inner.y) : inner.y + arc + inner.x - min(a.x, inner.x));
  if (p.x < 0.0) s = p.y >= 0.0 ? 2.0 * quarter - s : 2.0 * quarter + s;
  else if (p.y < 0.0) s = 4.0 * quarter - s;
  return s / max(4.0 * quarter, 0.0001);
}

float lobe(float position, float center) {
  float gap = abs(fract(position - center + 0.5) - 0.5);
  return 1.0 - smoothstep(uShineSize, uShineSize + uShineFade, gap);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = shapeSDF(p);
  float position = loopPosition(p, uHalfSize, uRadius);
  float key = lobe(position, uSpot);
  float back = lobe(position, uSpot + 0.5);
  float streak = key + back * 0.45;
  float width = max(uThickness * uPx * mix(1.0, max(key, back), 0.6), 0.35);
  float band = smoothstep(-width - 0.6, -width + 0.6, d) * (1.0 - smoothstep(-0.6, 0.6, d));
  float hair = smoothstep(-uPx - 0.6, -uPx + 0.6, d) * (1.0 - smoothstep(-0.6, 0.6, d));
  float inside = 1.0 - smoothstep(-0.6, 0.6, d);
  vec2 pool = (p - uEntry) / (uHalfSize.y * vec2(1.6, 1.1));
  float glow = streak * 0.2 * exp(-abs(d + width * 0.5) / (5.0 * uPx)) + inside * 0.08 * exp(-dot(pool, pool));
  float light = clamp((band * streak + glow * uGlow) * uIntensity, 0.0, 1.0);

  // Premultiplied, and only non-zero near the rim/glow — the interior stays
  // fully transparent away from the highlight instead of filling solid.
  vec4 base = vec4(uBaseColor, 1.0) * hair * 0.6;
  fragColor = vec4(uLineColor, 1.0) * light + base * (1.0 - light);
}
`;

const wrap = (value: number) => value - Math.floor(value);

const loopPosition = (x: number, y: number, halfX: number, halfY: number, r: number) => {
  const innerX = halfX - r;
  const innerY = halfY - r;
  const arc = (Math.PI / 2) * r;
  const quarter = innerX + innerY + arc;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const qx = ax - innerX;
  const qy = ay - innerY;
  let s: number;
  if (qx > 0 && qy > 0) s = innerY + Math.atan2(qy, qx) * r;
  else if (qx > qy) s = Math.min(ay, innerY);
  else s = innerY + arc + innerX - Math.min(ax, innerX);
  if (x < 0) s = y >= 0 ? 2 * quarter - s : 2 * quarter + s;
  else if (y < 0) s = 4 * quarter - s;
  return wrap(s / Math.max(4 * quarter, 0.0001));
};

const rimPoint = (position: number, halfX: number, halfY: number, r: number): [number, number] => {
  const innerX = halfX - r;
  const innerY = halfY - r;
  const arc = (Math.PI / 2) * r;
  const quarter = innerX + innerY + arc;
  let s = wrap(position) * 4 * quarter;
  let signX = 1;
  let signY = 1;
  if (s > 3 * quarter) {
    s = 4 * quarter - s;
    signY = -1;
  } else if (s > 2 * quarter) {
    s -= 2 * quarter;
    signX = -1;
    signY = -1;
  } else if (s > quarter) {
    s = 2 * quarter - s;
    signX = -1;
  }
  let x = innerX - (s - innerY - arc);
  let y = halfY;
  if (s <= innerY) {
    x = halfX;
    y = s;
  } else if (s <= innerY + arc) {
    const angle = (s - innerY) / Math.max(r, 0.0001);
    x = innerX + Math.cos(angle) * r;
    y = innerY + Math.sin(angle) * r;
  }
  return [x * signX, y * signY];
};

const restSpot = (radius: number, w: number, h: number) => {
  const r = Math.min(radius, w / 2, h / 2);
  const inset = r * (1 - Math.SQRT1_2);
  return loopPosition(inset - w / 2, h / 2 - inset, w / 2, h / 2, r);
};

const aimSpot = (radius: number, proximity: number, w: number, h: number, px: number, py: number) => {
  const halfX = w / 2;
  const halfY = h / 2;
  const r = Math.min(radius, halfX, halfY);
  const dx = Math.max(Math.abs(px) - halfX, 0);
  const dy = Math.max(Math.abs(py) - halfY, 0);
  const distance = Math.hypot(dx, dy);
  const t = Math.max(0, 1 - distance / Math.max(proximity, 1));
  const near = t * t * (3 - 2 * t);
  const nearest = loopPosition(px, py, halfX, halfY, r);
  if (distance > 0) return { spot: nearest, near };
  const depth = Math.max(0, Math.min(1, Math.min(halfX - Math.abs(px), halfY - Math.abs(py)) / (halfY * 0.8)));
  const sway = restSpot(radius, w, h) - (px / halfX) * 0.06 - (py / halfY) * 0.02;
  const offset = sway - nearest - Math.round(sway - nearest);
  const smoothDepth = depth * depth * (3 - 2 * depth);
  return { spot: wrap(nearest + offset * smoothDepth), near };
};

const SpecularButton = forwardRef<HTMLButtonElement, SpecularButtonProps>(({
  children = 'Get Started',
  size = 'lg',
  radius = 18,
  tint = '#ffffff',
  tintOpacity = 0,
  blur = 0,
  textColor = '#f5f5f5',
  lineColor = '#ffffff',
  baseColor = '#525252',
  intensity = 1,
  shineSize = 10,
  shineFade = 40,
  thickness = 1,
  glow = 1,
  speed = 0.35,
  followMouse = true,
  proximity = 250,
  autoAnimate = false,
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  title,
  'aria-expanded': ariaExpanded,
  'aria-haspopup': ariaHasPopup
}, forwardedRef) => {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const setRefs = (node: HTMLButtonElement | null) => {
    btnRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };
  const fxRef = useRef<HTMLSpanElement>(null);
  const propsRef = useRef<ShaderProps>({} as ShaderProps);

  propsRef.current = { radius, lineColor, baseColor, intensity, shineSize, shineFade, thickness, glow, speed, followMouse, proximity, autoAnimate };

  useEffect(() => {
    const btn = btnRef.current;
    const fx = fxRef.current;
    if (!btn || !fx) return;

    // WebGL2 context creation can fail (disabled WebGL, blacklisted GPU,
    // locked-down browser policy) on any browser. This effect is purely a
    // decorative shine on top of a fully functional <button> - if it fails,
    // skip the effect rather than letting the error take out the button.
    const dpr = window.devicePixelRatio || 1;
    let renderer: Renderer;
    let gl: Renderer['gl'];
    try {
      renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true, dpr });
      gl = renderer.gl;
      if (!gl) return;
    } catch {
      return;
    }

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const geometry = new Triangle(gl);
    if (geometry.attributes.uv) delete geometry.attributes.uv;

    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uCenter: { value: [0, 0] },
        uHalfSize: { value: [1, 1] },
        uRadius: { value: 0 },
        uPx: { value: dpr },
        uSpot: { value: 0 },
        uEntry: { value: [0, 0] },
        uLineColor: { value: [1, 1, 1] },
        uBaseColor: { value: [0.32, 0.32, 0.32] },
        uIntensity: { value: 1 },
        uShineSize: { value: 0.03 },
        uShineFade: { value: 0.11 },
        uThickness: { value: 1 },
        uGlow: { value: 1 }
      }
    });

    const mesh = new Mesh(gl, { geometry, program });
    fx.appendChild(gl.canvas);

    const sizeRef = { w: 1, h: 1 };
    const resize = () => {
      // Fractional size + explicit center keep the SDF pinned to the exact
      // CSS border, instead of drifting up to a pixel from offsetWidth rounding.
      const rect = btn.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      sizeRef.w = w;
      sizeRef.h = h;
      renderer.setSize(w + PAD * 2, h + PAD * 2);
      program.uniforms.uCenter.value = [(PAD + w / 2) * dpr, (PAD + h / 2) * dpr];
      program.uniforms.uHalfSize.value = [(w / 2) * dpr, (h / 2) * dpr];
    };
    const ro = new ResizeObserver(resize);
    ro.observe(btn);
    resize();

    // The highlight's target position travels around the full rim (as a
    // loop fraction) toward the pointer's nearest point on the border,
    // and falls back to a slow sweep around the loop when idle.
    let pointerX = 0;
    let pointerY = 0;
    let pointerKnown = false;
    const onPointerMove = (e: PointerEvent) => {
      const rect = btn.getBoundingClientRect();
      const scale = rect.width / sizeRef.w || 1;
      pointerX = (e.clientX - rect.left - rect.width / 2) / scale;
      pointerY = (rect.top + rect.height / 2 - e.clientY) / scale;
      pointerKnown = true;
    };
    window.addEventListener('pointermove', onPointerMove);

    let spot = restSpot(propsRef.current.radius, sizeRef.w, sizeRef.h);
    let bright = 0;
    let last = performance.now();
    let raf = 0;

    const lineC = new Color();
    const baseC = new Color();

    const update = (now: number) => {
      raf = requestAnimationFrame(update);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const p = propsRef.current;

      const halfX = sizeRef.w / 2;
      const halfY = sizeRef.h / 2;
      const r = Math.min(p.radius, halfX, halfY);

      const target =
        p.followMouse && pointerKnown ? aimSpot(p.radius, p.proximity, sizeRef.w, sizeRef.h, pointerX, pointerY) : null;
      const steering = !!target && target.near > 0;
      const spinning = p.autoAnimate && !steering;

      if (spinning) {
        spot = wrap(spot + (p.speed / (Math.PI * 2)) * dt);
      } else {
        const aimed = steering ? (target as { spot: number }).spot : restSpot(p.radius, sizeRef.w, sizeRef.h);
        let diff = aimed - spot;
        diff -= Math.round(diff);
        spot = wrap(spot + diff * (1 - Math.exp(-dt * 8)));
      }

      // Shine fades in with pointer proximity unless autoAnimate keeps it on
      const brightTarget = p.autoAnimate ? 1 : steering ? (target as { near: number }).near : 0;
      bright += (brightTarget - bright) * (1 - Math.exp(-dt * 7));

      lineC.set(p.lineColor);
      baseC.set(p.baseColor);

      const [rimX, rimY] = rimPoint(spot, halfX, halfY, r);
      const rimDist = Math.hypot(rimX, rimY);
      const pull = 1 - Math.min(0.35 * halfY, rimDist) / Math.max(rimDist, 0.0001);

      program.uniforms.uRadius.value = r * dpr;
      program.uniforms.uSpot.value = spot;
      program.uniforms.uEntry.value = [rimX * pull * dpr, rimY * pull * dpr];
      program.uniforms.uLineColor.value = [lineC.r, lineC.g, lineC.b];
      program.uniforms.uBaseColor.value = [baseC.r, baseC.g, baseC.b];
      program.uniforms.uIntensity.value = p.intensity * bright;
      program.uniforms.uShineSize.value = p.shineSize / 360 + 0.0001;
      program.uniforms.uShineFade.value = p.shineFade / 360 + 0.0001;
      program.uniforms.uThickness.value = p.thickness * dpr;
      program.uniforms.uGlow.value = p.glow;
      renderer.render({ scene: mesh });
    };
    raf = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      if (gl.canvas.parentNode === fx) fx.removeChild(gl.canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  return (
    <button
      ref={setRefs}
      type={type}
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHasPopup}
      className={`specular-button specular-button--${size}${className ? ` ${className}` : ''}`}
      style={
        {
          '--sb-radius': `${radius}px`,
          '--sb-tint': tint,
          '--sb-tint-opacity': tintOpacity,
          '--sb-blur': `${blur}px`,
          '--sb-text-color': textColor
        } as CSSProperties
      }
    >
      <span ref={fxRef} className="specular-button__fx" aria-hidden="true" />
      <span className="specular-button__label">{children}</span>
    </button>
  );
});

SpecularButton.displayName = 'SpecularButton';

export default SpecularButton;
