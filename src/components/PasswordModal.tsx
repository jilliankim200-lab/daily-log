import { useState, useEffect } from 'react';
import { X, Lock } from 'lucide-react';

interface PasswordModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PasswordModal({ open, onClose, onSuccess }: PasswordModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setPassword('');
      setError('');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '8036') {
      onSuccess();
      onClose();
      setPassword('');
      setError('');
    } else {
      setError('비밀번호가 올바르지 않습니다.');
      setPassword('');
    }
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: 360, margin: '0 16px',
        background: 'var(--bg-primary)', borderRadius: 16,
        border: '1px solid var(--border-primary)',
        boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-primary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Lock style={{ width: 18, height: 18, color: '#fff' }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              금액 보기
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              color: 'var(--text-tertiary)', borderRadius: 8,
            }}
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
            금액 정보를 보려면 비밀번호를 입력하세요.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label
                htmlFor="password"
                style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}
              >
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="비밀번호 입력"
                autoFocus
                maxLength={4}
                style={{
                  width: '100%', padding: '12px 14px', fontSize: 15,
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                  border: error ? '1.5px solid var(--color-loss)' : '1.5px solid var(--border-primary)',
                  borderRadius: 10, outline: 'none',
                  transition: 'border-color 0.15s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
                onBlur={(e) => { if (!error) e.currentTarget.style.borderColor = 'var(--border-primary)'; }}
              />
              {error && (
                <p style={{ fontSize: 13, color: 'var(--color-loss)', marginTop: 8 }}>
                  {error}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1, padding: '12px 0', fontSize: 15, fontWeight: 600,
                  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                  border: 'none', borderRadius: 10, cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
              >
                취소
              </button>
              <button
                type="submit"
                style={{
                  flex: 1, padding: '12px 0', fontSize: 15, fontWeight: 600,
                  background: 'var(--accent-blue)', color: '#fff',
                  border: 'none', borderRadius: 10, cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                확인
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
