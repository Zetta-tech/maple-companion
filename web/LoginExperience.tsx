import { useState, type ReactNode } from 'react';
import './LoginExperience.css';

/** App-owned presentation only. The supplied Clerk sign-in keeps its own flow. */
export function LoginExperience({ children }: { children: ReactNode }) {
  const [motionPaused, setMotionPaused] = useState(false);
  return <div className="login-experience" data-motion={motionPaused ? 'paused' : 'running'}>
    <div className="login-leaf-window" aria-hidden="true">
      <svg className="login-leaf" viewBox="0 0 400 420" focusable="false">
        <path d="M200 30 177 80 139 67 149 153 95 101 83 131 35 122 51 171 25 190 112 260 88 291 185 275 182 364 210 364 207 275 304 291 280 260 367 190 341 171 357 122 309 131 297 101 243 153 253 67 215 80Z" />
        <path className="login-leaf-veins" d="M196 317 196 131M196 255 116 181M196 255 277 181M196 207 163 127M196 207 230 127" />
      </svg>
    </div>
    <section className="login-intro" aria-labelledby="login-heading">
      <p className="login-kicker">Welcome to Maple</p>
      <h1 id="login-heading">A clearer next step<br className="login-title-break" /> starts with you.</h1>
      <p className="login-description">Keep your information up to date. See what changes could mean for you, with the evidence close at hand.</p>
      <p className="login-continuation">Sign in to your private workspace.</p>
    </section>
    <section className="login-form-region" aria-label="Sign in">
      {children}
    </section>
    <button type="button" className="login-motion-toggle" aria-pressed={motionPaused} onClick={() => setMotionPaused(paused => !paused)}>
      {motionPaused ? 'Resume leaf motion' : 'Pause leaf motion'}
    </button>
  </div>;
}
