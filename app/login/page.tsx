'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSent('');
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'That email and password do not match an account.'
          : error.message
      );
      return;
    }
    router.push('/');
    router.refresh();
  }

  async function reset() {
    if (!email) {
      setError('Enter your email first, then use the reset link.');
      return;
    }
    setError('');
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(`Password reset sent to ${email}.`);
  }

  return (
    <div className="loginwrap">
      <div className="logincard">
        <h1>
          Sidana <span style={{ color: 'var(--accent)' }}>Ops Console</span>
        </h1>
        <p className="hint">Accounts are created by an owner. There is no signup.</p>

        {error && <div className="err">{error}</div>}
        {sent && <div className="ok">{sent}</div>}

        <form onSubmit={signIn}>
          <label className="field" htmlFor="email">
            <span>Email</span>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="field" htmlFor="password">
            <span>Password</span>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="submit" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <button className="linkbtn" type="button" onClick={reset} disabled={busy}>
          Forgot password
        </button>
      </div>
    </div>
  );
}
