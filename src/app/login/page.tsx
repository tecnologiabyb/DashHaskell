'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) window.location.href = '/';
    else setError('Senha incorreta');
  }

  return (
    <main className="login">
      <form onSubmit={submit}>
        <img src="/haskell-logo.webp" alt="Haskell Cosméticos" />
        <h1>Relatório de Marketing</h1>
        <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus aria-label="Senha" />
        <button className="btn" disabled={busy || !password}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        {error && <div className="err">{error}</div>}
      </form>
    </main>
  );
}
