'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, setLocale, t } = useLanguage();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Show error if Google OAuth failed
  useEffect(() => {
    if (searchParams.get('error') === 'oauth') {
      setError(t('auth.oauthError'));
    }
  }, [searchParams, t]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const body = isRegister ? { name, email, password } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('auth.error')); return; }
      router.push('/');
      router.refresh();
    } catch {
      setError(t('auth.connectionError'));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--background-alt)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--background)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="text-5xl mb-4 animate-float">🪷</div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
            {t('app.name')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>
            {t('app.subtitle')}
          </p>
          {/* Language switcher */}
          <button
            onClick={() => setLocale(locale === 'th' ? 'en' : 'th')}
            className="mt-3 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors"
            style={{ color: 'var(--gold)', borderColor: 'var(--gold)', background: 'transparent' }}
          >
            {t('lang.switch')}
          </button>
        </div>

        {/* Form */}
        <div
          className="rounded-2xl p-6 animate-fade-in"
          style={{
            background: 'var(--background)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}
        >
          <h2 className="text-lg font-semibold mb-5 text-center" style={{ color: 'var(--foreground)' }}>
            {isRegister ? t('auth.register') : t('auth.login')}
          </h2>

          {error && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-sm"
              style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                  {t('auth.name')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('auth.namePlaceholder')}
                  required
                  className="w-full px-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 transition-all"
                  style={{ ...inputStyle, '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                {t('auth.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                required
                className="w-full px-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 transition-all"
                style={{ ...inputStyle, '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                {t('auth.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isRegister ? t('auth.passwordMinLength') : t('auth.passwordPlaceholder')}
                required
                minLength={isRegister ? 6 : undefined}
                className="w-full px-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 transition-all"
                style={{ ...inputStyle, '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-base font-medium transition-all disabled:opacity-50 active:scale-[0.98]"
              style={{ background: 'var(--foreground)', color: 'var(--background)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('auth.processing')}
                </span>
              ) : isRegister ? t('auth.registerButton') : t('auth.loginButton')}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{ background: 'var(--border-light)' }} />
            <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{t('auth.or')}</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border-light)' }} />
          </div>

          {/* Google sign-in */}
          <a
            href="/api/auth/google"
            className="flex items-center justify-center gap-3 w-full py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98] border"
            style={{ background: 'var(--background-alt)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            {/* Google logo SVG */}
            <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {t('auth.continueWithGoogle')}
          </a>

          <div className="mt-5 pt-4 text-center" style={{ borderTop: '1px solid var(--border-light)' }}>
            <button
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="text-sm font-medium transition-colors"
              style={{ color: 'var(--gold)' }}
            >
              {isRegister ? t('auth.hasAccount') : t('auth.noAccount')}
            </button>
          </div>
        </div>

        <p className="text-center text-xs mt-5" style={{ color: 'var(--foreground-muted)', opacity: 0.5 }}>
          {t('auth.secureNote')}
        </p>
      </div>
    </div>
  );
}
