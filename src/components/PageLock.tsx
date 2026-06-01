import React from 'react';
import { useAppContext } from '../App';
import { MIcon } from './MIcon';

export function PageLock({ children }: { children: React.ReactNode }) {
  const { isAmountHidden, openPasswordModal } = useAppContext();

  if (!isAmountHidden) return <>{children}</>;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      background: 'var(--bg-page)',
    }}>
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        borderRadius: 20,
        padding: '44px 52px',
        textAlign: 'center',
        maxWidth: 340,
        width: '100%',
        boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'var(--bg-tertiary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <MIcon name="lock" size={28} style={{ color: 'var(--text-tertiary)' }} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          잠긴 페이지
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 28 }}>
          이 페이지의 내용을 보려면<br />비밀번호를 입력해주세요.
        </div>
        <button
          onClick={openPasswordModal}
          style={{
            width: '100%',
            padding: '11px 0',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            background: 'var(--accent-blue)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'inherit',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          비밀번호 입력
        </button>
      </div>
    </div>
  );
}
