import { useState, useEffect, useCallback } from 'react';
import { MIcon } from './MIcon';
import { useAppContext } from '../App';
import { fetchSnapshots } from '../api';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://asset-dashboard-api.jilliankim200.workers.dev';

export function DataReports() {
  const { accounts } = useAppContext();
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { loadDates(); }, []);

  useEffect(() => {
    if (!previewing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreviewing(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewing]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  async function loadDates() {
    setLoading(true);
    try {
      const res = await fetch(`${WORKER_URL}/api/daily-reports`);
      const data = await res.json();
      setDates(Array.isArray(data) ? data : []);
    } catch {
      setDates([]);
    } finally {
      setLoading(false);
    }
  }

  const fetchContent = useCallback(async (date: string): Promise<string> => {
    const res = await fetch(`${WORKER_URL}/api/daily-reports/${date}`);
    if (!res.ok) throw new Error('not found');
    return res.text();
  }, []);

  async function handlePreview(date: string) {
    setPreviewing(date);
    setPreviewContent('');
    setPreviewLoading(true);
    try {
      const text = await fetchContent(date);
      setPreviewContent(text);
    } catch {
      setPreviewContent('불러오기 실패');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDownload(date: string) {
    setDownloading(date);
    try {
      const text = previewContent && previewing === date ? previewContent : await fetchContent(date);
      const blob = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${date}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      showToast('다운로드 실패');
    } finally {
      setDownloading(null);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const snapshots = await fetchSnapshots();
      window.dispatchEvent(new CustomEvent('snapshotsUpdated'));
      const res = await fetch(`${WORKER_URL}/api/daily-reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshots, accounts }),
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json() as { ok: boolean; date: string };
      showToast(`${data.date} 보고서 생성 완료`);
      await loadDates();
    } catch {
      showToast('생성 실패');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>데이터 보고서</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>매일 18:00 자동 생성 · 미리보기 · TXT 다운로드</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-primary)',
            cursor: generating ? 'not-allowed' : 'pointer',
            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            fontSize: 13, fontWeight: 500, opacity: generating ? 0.6 : 1,
          }}
        >
          <MIcon name="add_circle" size={16} />
          {generating ? '생성 중...' : '오늘 보고서 생성'}
        </button>
      </div>

      {/* 목록 */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>불러오는 중...</div>
      ) : dates.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
          <MIcon name="folder_open" size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div>저장된 보고서가 없습니다</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>오늘 보고서 생성 버튼을 눌러보세요</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dates.map(date => (
            <div
              key={date}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderRadius: 10,
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-secondary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--accent-blue)',
                }}>
                  <MIcon name="description" size={18} style={{ color: 'var(--accent-blue-fg)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{date} 보고서</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>자산증감내역 · 계좌종목현황</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => handlePreview(date)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 6,
                    border: '1px solid var(--border-primary)',
                    cursor: 'pointer',
                    background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                    fontSize: 13, fontWeight: 500,
                  }}
                >
                  <MIcon name="visibility" size={14} />
                  미리보기
                </button>
                <button
                  onClick={() => handleDownload(date)}
                  disabled={downloading === date}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 6, border: 'none',
                    cursor: downloading === date ? 'not-allowed' : 'pointer',
                    background: 'var(--accent-blue)', color: 'var(--accent-blue-fg)',
                    fontSize: 13, fontWeight: 500, opacity: downloading === date ? 0.6 : 1,
                  }}
                >
                  <MIcon name="download" size={14} />
                  {downloading === date ? '...' : '다운로드'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 미리보기 모달 */}
      {previewing && (
        <div
          onClick={() => setPreviewing(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 720, maxHeight: '85vh',
              background: 'var(--bg-primary)', borderRadius: 14,
              border: '1px solid var(--border-primary)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* 모달 헤더 */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--border-primary)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MIcon name="description" size={18} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {previewing} 보고서
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleDownload(previewing)}
                  disabled={downloading === previewing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 6, border: 'none',
                    cursor: 'pointer', background: 'var(--accent-blue)', color: 'var(--accent-blue-fg)',
                    fontSize: 13, fontWeight: 500,
                  }}
                >
                  <MIcon name="download" size={14} />
                  다운로드
                </button>
                <button
                  onClick={() => setPreviewing(null)}
                  style={{
                    padding: 6, borderRadius: 6, border: 'none',
                    cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <MIcon name="close" size={20} />
                </button>
              </div>
            </div>

            {/* 내용 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {previewLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
                  불러오는 중...
                </div>
              ) : (
                <pre style={{
                  margin: 0, fontSize: 12, lineHeight: 1.7,
                  fontFamily: '"Consolas", "D2Coding", "Nanum Gothic Coding", monospace',
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre', overflowX: 'auto',
                }}>
                  {previewContent}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-elevated)', color: 'var(--text-primary)',
          padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 500,
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)', border: '1px solid var(--border-primary)',
          zIndex: 9999,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
