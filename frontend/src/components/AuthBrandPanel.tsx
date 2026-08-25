import '../pages/Login.css'

const STREAK_COUNT = 8

interface AuthBrandPanelProps {
  heading: string
  description: string
  showFeatures?: boolean
}

function AuthBrandPanel({ heading, description, showFeatures = false }: AuthBrandPanelProps) {
  return (
    <div className="login-left">
      <div className="login-streaks" aria-hidden="true">
        {Array.from({ length: STREAK_COUNT }).map((_, i) => (
          <div
            key={i}
            className="login-streak"
            style={{
              top: `${6 + i * 5}%`,
              width: `${90 + (i % 3) * 60}px`,
              opacity: 0.15 + (i % 4) * 0.04,
            }}
          />
        ))}
      </div>

      <div className="login-brand-block">
        <span className="login-brandmark">
          <span className="login-brandmark-glow" aria-hidden="true" />
          <span className="login-brandmark-ring">
            <img src="/nforce-logo.png" alt="NForce logo" className="login-brandmark-img" />
          </span>
        </span>
        <div>
          <div className="login-brand-title">NForce RetailOps</div>
          <div className="login-brand-subtitle">Retail Store Operations Platform</div>
        </div>
      </div>

      <div className="login-hero">
        <h2>{heading}</h2>
        <p>{description}</p>
      </div>

      {showFeatures ? (
        <div className="login-features">
          <div className="login-feature">
            <div className="login-feature-dot" />
            <div className="login-feature-title">Role-based access</div>
            <div className="login-feature-desc">Secure access by responsibility</div>
          </div>
          <div className="login-feature">
            <div className="login-feature-dot" />
            <div className="login-feature-title">Full audit trail</div>
            <div className="login-feature-desc">Every action tracked</div>
          </div>
          <div className="login-feature">
            <div className="login-feature-dot" />
            <div className="login-feature-title">Configurable checklists</div>
            <div className="login-feature-desc">Built for every store</div>
          </div>
        </div>
      ) : (
        <div />
      )}
    </div>
  )
}

export default AuthBrandPanel
