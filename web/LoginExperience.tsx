import type { ReactNode } from 'react';
import './LoginExperience.css';

/** App-owned presentation only. Clerk retains all sign-in and recovery states. */
export function LoginExperience({ children }: { children: ReactNode }) {
  return <div className="login-experience">
    <div className="login-leaf-window" aria-hidden="true"><div className="login-leaf" /></div>
    <section className="login-form-region" aria-label="Sign in to Maple">{children}</section>
  </div>;
}
