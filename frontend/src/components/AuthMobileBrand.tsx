import '../pages/Login.css'

function AuthMobileBrand() {
  return (
    <div className="login-mobile-brand">
      <span className="login-brandmark">
        <span className="login-brandmark-glow" aria-hidden="true" />
        <span className="login-brandmark-ring">
          <img src="/nforce-logo.png" alt="NForce logo" className="login-brandmark-img" />
        </span>
      </span>
      <div className="login-mobile-brand-text">
        <div className="login-brand-title">NForce RetailOps</div>
        <div className="login-brand-subtitle">Retail Store Operations Platform</div>
      </div>
    </div>
  )
}

export default AuthMobileBrand
