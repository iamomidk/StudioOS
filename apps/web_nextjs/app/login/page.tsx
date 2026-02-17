'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('owner@studioos.dev');
  const [password, setPassword] = useState('Password123!');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage('Login failed. Check credentials and API availability.');
      return;
    }

    router.replace('/dashboard');
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        style={{
          width: 'min(420px, 100%)',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          padding: 24,
          display: 'grid',
          gap: 12
        }}
      >
        <h1 style={{ margin: 0 }}>StudioOS Login</h1>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            style={{ width: '100%', marginTop: 6, padding: 10 }}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            style={{ width: '100%', marginTop: 6, padding: 10 }}
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            border: 0,
            borderRadius: 10,
            padding: '10px 14px',
            background: 'var(--accent)',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
        {errorMessage && <p style={{ color: '#8b1f1f', margin: 0 }}>{errorMessage}</p>}
      </form>
    </main>
  );
}
