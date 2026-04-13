'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return; }
      router.push('/');
      router.refresh();
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
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
            ธรรมสหาย
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>
            ผู้ช่วยค้นคว้าพระไตรปิฎกและหลักธรรมเถรวาท
          </p>
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
            {isRegister ? 'สร้างบัญชีใหม่' : 'เข้าสู่ระบบ'}
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
                  ชื่อ / ฉายา
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="เช่น พระมหาสมชาย"
                  required
                  className="w-full px-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 transition-all"
                  style={{ ...inputStyle, '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                อีเมล
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                className="w-full px-4 py-3 rounded-xl text-base focus:outline-none focus:ring-2 transition-all"
                style={{ ...inputStyle, '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                รหัสผ่าน
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isRegister ? 'อย่างน้อย 6 ตัวอักษร' : 'รหัสผ่าน'}
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
                  กำลังดำเนินการ...
                </span>
              ) : isRegister ? 'สร้างบัญชี' : 'เข้าสู่ระบบ'}
            </button>
          </form>

          <div className="mt-5 pt-4 text-center" style={{ borderTop: '1px solid var(--border-light)' }}>
            <button
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="text-sm font-medium transition-colors"
              style={{ color: 'var(--gold)' }}
            >
              {isRegister ? 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ' : 'ยังไม่มีบัญชี? สร้างบัญชีใหม่'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs mt-5" style={{ color: 'var(--foreground-muted)', opacity: 0.5 }}>
          ข้อมูลของท่านจะถูกเก็บรักษาอย่างปลอดภัย
        </p>
      </div>
    </div>
  );
}
