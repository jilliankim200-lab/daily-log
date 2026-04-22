import React, { useState, useEffect, useId } from 'react';
import { useAppContext } from '../App';
import { kvGet, kvSet } from '../api';
import { MIcon } from './MIcon';
import type { Account } from '../types';
import { holdingValue } from '../types';

interface AccountRow {
  id: string;
  name: string;
  owner: 'wife' | 'husband' | 'other';
  before2024: number;
  deposit2024: number;
  close2024: number;
  balance2025: number;
  deposit2025: number;
  actual2026: number;
  deposit2026: number;
  linkedAccId?: string;
}

const SEED: AccountRow[] = [
  { id:'w1',  name:'퇴직연금 IRP',    owner:'wife',    before2024:27000000,  deposit2024:3000000,  close2024:34735619,  balance2025:38628835,  deposit2025:3000000,  actual2026:0, deposit2026:3000000  },
  { id:'w2',  name:'ISA',             owner:'wife',    before2024:0,         deposit2024:18800000, close2024:18219580,  balance2025:21812075,  deposit2025:0,        actual2026:0, deposit2026:20000000 },
  { id:'w3',  name:'펀슈 (세제)',      owner:'wife',    before2024:42000000,  deposit2024:6000000,  close2024:53884340,  balance2025:72647218,  deposit2025:6000000,  actual2026:0, deposit2026:6000000  },
  { id:'w4',  name:'한투',            owner:'wife',    before2024:0,         deposit2024:9000000,  close2024:9950376,   balance2025:21951600,  deposit2025:9000000,  actual2026:0, deposit2026:9000000  },
  { id:'w5',  name:'KB퇴직연금 IRP',  owner:'wife',    before2024:0,         deposit2024:3000000,  close2024:4227286,   balance2025:6533394,   deposit2025:3000000,  actual2026:0, deposit2026:3000000  },
  { id:'h1',  name:'오빠퇴직연금IRP', owner:'husband', before2024:12700000,  deposit2024:3000000,  close2024:17545387,  balance2025:22340687,  deposit2025:3000000,  actual2026:0, deposit2026:3000000  },
  { id:'h2',  name:'오빠SA 미래',     owner:'husband', before2024:0,         deposit2024:19000000, close2024:0,         balance2025:6701364,   deposit2025:6100000,  actual2026:0, deposit2026:20000000 },
  { id:'h3',  name:'오빠펀슈 (세제)', owner:'husband', before2024:48200000,  deposit2024:4400000,  close2024:61180917,  balance2025:75207806,  deposit2025:4400000,  actual2026:0, deposit2026:4400000  },
  { id:'h4',  name:'오빠미래에셋연금',owner:'husband', before2024:0,         deposit2024:9000000,  close2024:33501364,  balance2025:51014205,  deposit2025:0,        actual2026:0, deposit2026:9000000  },
  { id:'w6',  name:'예금',            owner:'wife',    before2024:0,         deposit2024:0,        close2024:0,         balance2025:0,         deposit2025:0,        actual2026:0, deposit2026:0        },
  { id:'w7',  name:'우리사주',        owner:'wife',    before2024:12071910,  deposit2024:0,        close2024:12071910,  balance2025:11501175,  deposit2025:0,        actual2026:0, deposit2026:0        },
  { id:'w8',  name:'퇴직연금DC',      owner:'wife',    before2024:49709764,  deposit2024:0,        close2024:60021742,  balance2025:82706419,  deposit2025:0,        actual2026:0, deposit2026:0        },
  { id:'w9',  name:'유진',            owner:'wife',    before2024:8938025,   deposit2024:0,        close2024:8938025,   balance2025:8927250,   deposit2025:0,        actual2026:0, deposit2026:0        },
  { id:'w10', name:'키움',            owner:'wife',    before2024:7401710,   deposit2024:0,        close2024:7401710,   balance2025:8044369,   deposit2025:0,        actual2026:0, deposit2026:0        },
  { id:'w11', name:'일드맥스',        owner:'wife',    before2024:0,         deposit2024:0,        close2024:0,         balance2025:11965112,  deposit2025:14000000, actual2026:0, deposit2026:0        },
  { id:'w12', name:'미래해외',        owner:'wife',    before2024:13881343,  deposit2024:0,        close2024:13421244,  balance2025:11881390,  deposit2025:0,        actual2026:0, deposit2026:0        },
  { id:'o1',  name:'비트코인',        owner:'other',   before2024:0,         deposit2024:0,        close2024:9000000,   balance2025:29922411,  deposit2025:23000000, actual2026:0, deposit2026:0        },
  { id:'o2',  name:'기타증권',        owner:'other',   before2024:0,         deposit2024:0,        close2024:0,         balance2025:13064239,  deposit2025:0,        actual2026:0, deposit2026:2000000  },
  { id:'h5',  name:'오빠퇴직연금DC',  owner:'husband', before2024:56520303,  deposit2024:0,        close2024:56648162,  balance2025:56927615,  deposit2025:0,        actual2026:0, deposit2026:0        },
  { id:'h6',  name:'오빠일드맥스',    owner:'husband', before2024:0,         deposit2024:0,        close2024:0,         balance2025:16151904,  deposit2025:14500000, actual2026:0, deposit2026:0        },
  { id:'o3',  name:'기타',            owner:'other',   before2024:0,         deposit2024:0,        close2024:0,         balance2025:0,         deposit2025:0,        actual2026:0, deposit2026:0        },
  { id:'o4',  name:'대출',            owner:'other',   before2024:0,         deposit2024:0,        close2024:0,         balance2025:0,         deposit2025:9000000,  actual2026:0, deposit2026:12000000 },
];

const OWNER_LABEL: Record<string, string> = { wife: '지윤', husband: '오빠', other: '기타' };
const OWNER_COLOR: Record<string, string> = {
  wife:    'var(--color-profit)',
  husband: 'var(--accent-blue)',
  other:   'var(--text-tertiary)',
};

function fmt(v: number) { return v.toLocaleString('ko-KR'); }
function parseNum(s: string) { const n = parseInt(s.replace(/[^0-9-]/g, ''), 10); return isNaN(n) ? 0 : n; }
function calcRow(r: AccountRow) {
  const totalDeposit = r.before2024 + r.deposit2024 + r.deposit2025 + r.actual2026;
  const current = r.balance2025;
  const gain    = current - totalDeposit;
  const rate    = totalDeposit > 0 ? (gain / totalDeposit) * 100 : 0;
  return { totalDeposit, current, gain, rate };
}
function gainColor(v: number) {
  return v > 0 ? 'var(--color-profit)' : v < 0 ? 'var(--color-loss)' : 'var(--text-primary)';
}
function newId() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

type SortKey    = 'rate' | 'gain' | 'current' | 'deposit';
type OwnerFilter = 'all' | 'wife' | 'husband' | 'other';

// ── 숫자 입력 셀 ──
function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(value === 0 ? '' : value.toLocaleString('ko-KR'));
  const handleBlur = () => {
    const n = parseNum(text);
    onChange(n);
    setText(n === 0 ? '' : n.toLocaleString('ko-KR'));
  };
  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={handleBlur}
      style={{
        width: '100%', border: '1px solid var(--border-primary)', borderRadius: 6,
        padding: '4px 8px', fontSize: 'var(--text-xs)', background: 'var(--bg-primary)',
        color: 'var(--text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums',
        outline: 'none', minWidth: 90,
      }}
    />
  );
}

export function AccountReturn() {
  const { isAmountHidden, isMobile, prices } = useAppContext();
  const [rows, setRows]       = useState<AccountRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('rate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [editing, setEditing] = useState(false);
  const [editRows, setEditRows] = useState<AccountRow[]>([]);
  const [saving, setSaving]   = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    kvGet<AccountRow[]>('contributions_v2').then(d => {
      const data = (d && d.length > 0) ? d.map(r => ({ actual2026: 0, ...r })) : SEED;
      setRows(data);
    });
    kvGet<Account[]>('accounts').then(d => { if (d) setAccounts(d); });
  }, []);

  // ── 편집 시작 ──
  const startEdit = () => {
    setEditRows(rows.map(r => ({ ...r })));
    setEditing(true);
    setDeleteConfirm(null);
  };

  // ── 저장 ──
  const handleSave = async () => {
    setSaving(true);
    try {
      await kvSet('contributions_v2', editRows);
      setRows(editRows);
      setEditing(false);
    } catch (e) {
      alert('저장 실패. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  // ── 취소 ──
  const handleCancel = () => { setEditing(false); setDeleteConfirm(null); };

  // ── 잔액 동기화 (계좌종목등록 합계 → balance2025) ──
  const calcAccBal = (acc: Account, p: Record<string, number> = prices) =>
    Math.round(acc.holdings.reduce((s, h) => s + holdingValue(h, p[h.ticker]), acc.cash || 0));

  const syncBalances = async () => {
    setSyncing(true);
    try {
      const fresh = await kvGet<Account[]>('accounts') || accounts;
      const updated = rows.map(r => {
        if (!r.linkedAccId) return r;
        const acc = fresh.find(a => a.id === r.linkedAccId);
        return acc ? { ...r, balance2025: calcAccBal(acc) } : r;
      });
      await kvSet('contributions_v2', updated);
      setRows(updated);
      setAccounts(fresh);
    } finally {
      setSyncing(false);
    }
  };

  // ── 편집 모드: 계좌 연결 + 잔액 자동 계산 ──
  const linkAccount = (rowId: string, accId: string) => {
    setEditRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const acc = accounts.find(a => a.id === accId);
      const bal = acc ? calcAccBal(acc) : r.balance2025;
      return { ...r, linkedAccId: accId || undefined, balance2025: accId ? bal : r.balance2025 };
    }));
  };

  // ── 행 수정 ──
  const updateRow = (id: string, field: keyof AccountRow, value: string | number) => {
    setEditRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // ── 행 추가 ──
  const addRow = () => {
    const blank: AccountRow = {
      id: newId(), name: '새 계좌', owner: 'wife',
      before2024: 0, deposit2024: 0, close2024: 0,
      balance2025: 0, deposit2025: 0, actual2026: 0, deposit2026: 0,
    };
    setEditRows(prev => [...prev, blank]);
  };

  // ── 행 삭제 ──
  const deleteRow = (id: string) => {
    if (deleteConfirm === id) {
      setEditRows(prev => prev.filter(r => r.id !== id));
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
    }
  };

  // ── 필터·정렬 ──
  const source = editing ? editRows : rows;
  const filtered = source
    .filter(r => ownerFilter === 'all' || r.owner === ownerFilter)
    .filter(r => { const { totalDeposit, current } = calcRow(r); return totalDeposit > 0 || current > 0; });

  const sorted = editing ? filtered : [...filtered].sort((a, b) => {
    const ca = calcRow(a), cb = calcRow(b);
    const av = ca[sortKey === 'deposit' ? 'totalDeposit' : sortKey];
    const bv = cb[sortKey === 'deposit' ? 'totalDeposit' : sortKey];
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  const totals = sorted.reduce((acc, r) => {
    const c = calcRow(r);
    return { deposit: acc.deposit + c.totalDeposit, current: acc.current + c.current, gain: acc.gain + c.gain };
  }, { deposit: 0, current: 0, gain: 0 });
  const totalRate = totals.deposit > 0 ? (totals.gain / totals.deposit) * 100 : 0;

  const toggleSort = (key: SortKey) => {
    if (editing) return;
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey === k) return <MIcon name={sortDir === 'desc' ? 'arrow_downward' : 'arrow_upward'} size={14} />;
    return <MIcon name="unfold_more" size={14} style={{ opacity: 0.3 }} />;
  };

  // ── 편집 모드 테이블 ──
  if (editing) {
    return (
      <div style={{ padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 편집 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>계좌수익률 편집</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 4 }}>
              수정 후 저장하면 서버에 반영됩니다
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCancel} style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 'var(--text-sm)', fontWeight: 600,
              border: '1px solid var(--border-primary)', cursor: 'pointer',
              background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
            }}>
              취소
            </button>
            <button onClick={handleSave} disabled={saving} style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 'var(--text-sm)', fontWeight: 600,
              border: 'none', cursor: saving ? 'wait' : 'pointer',
              background: 'var(--accent-blue)', color: 'var(--accent-blue-fg)',
              opacity: saving ? 0.6 : 1,
            }}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        {/* 편집 테이블 */}
        <div style={{ background: 'var(--bg-primary)', borderRadius: 16, border: '1px solid var(--border-primary)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
                {['소유자', '계좌명', '이전입금', "'24입금", "'25입금", "'26실제입금", '현재잔액', ''].map(h => (
                  <th key={h} style={{
                    padding: '10px 12px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)',
                    textAlign: h === '소유자' || h === '계좌명' || h === '' ? 'left' : 'right', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {editRows.filter(r => {
                const { totalDeposit, current } = calcRow(r);
                return totalDeposit > 0 || current > 0 || r.name === '새 계좌';
              }).map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  {/* 소유자 */}
                  <td style={{ padding: '8px 12px' }}>
                    <select
                      value={r.owner}
                      onChange={e => updateRow(r.id, 'owner', e.target.value)}
                      style={{
                        border: '1px solid var(--border-primary)', borderRadius: 6, padding: '4px 6px',
                        fontSize: 'var(--text-xs)', background: 'var(--bg-primary)', color: OWNER_COLOR[r.owner], fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <option value="wife">지윤</option>
                      <option value="husband">오빠</option>
                      <option value="other">기타</option>
                    </select>
                  </td>
                  {/* 계좌명 */}
                  <td style={{ padding: '8px 12px' }}>
                    <input
                      type="text"
                      value={r.name}
                      onChange={e => updateRow(r.id, 'name', e.target.value)}
                      style={{
                        border: '1px solid var(--border-primary)', borderRadius: 6,
                        padding: '4px 8px', fontSize: 'var(--text-sm)', fontWeight: 600,
                        background: 'var(--bg-primary)', color: 'var(--text-primary)',
                        minWidth: 100, outline: 'none',
                      }}
                    />
                  </td>
                  {/* 숫자 필드들 */}
                  {(['before2024', 'deposit2024', 'deposit2025', 'actual2026'] as const).map(field => (
                    <td key={field} style={{ padding: '8px 12px' }}>
                      <NumInput value={r[field]} onChange={v => updateRow(r.id, field, v)} />
                    </td>
                  ))}
                  {/* 현재잔액 — 계좌 연결 or 수동 입력 */}
                  <td style={{ padding: '8px 12px', minWidth: 160 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <select
                        value={r.linkedAccId || ''}
                        onChange={e => linkAccount(r.id, e.target.value)}
                        style={{
                          fontSize: 'var(--text-xs)', border: '1px solid var(--border-primary)', borderRadius: 6,
                          padding: '3px 6px', background: 'var(--bg-primary)', color: r.linkedAccId ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                          cursor: 'pointer', maxWidth: 150, fontWeight: r.linkedAccId ? 600 : 400,
                        }}
                      >
                        <option value="">수동 입력</option>
                        {accounts
                          .filter(a => r.owner === 'other' || a.owner === r.owner)
                          .map(a => (
                            <option key={a.id} value={a.id}>
                              {a.alias || `${a.institution} ${a.accountType}`}
                            </option>
                          ))
                        }
                      </select>
                      <NumInput value={r.balance2025} onChange={v => updateRow(r.id, 'balance2025', v)} />
                    </div>
                  </td>
                  {/* 삭제 */}
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <button
                      onClick={() => deleteRow(r.id)}
                      title={deleteConfirm === r.id ? '한 번 더 클릭하면 삭제됩니다' : '삭제'}
                      style={{
                        border: 'none', borderRadius: 6, padding: '4px 8px',
                        cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 600,
                        background: deleteConfirm === r.id
                          ? 'var(--color-profit)' : 'color-mix(in srgb, var(--color-profit) 10%, transparent)',
                        color: deleteConfirm === r.id ? '#fff' : 'var(--color-profit)',
                        whiteSpace: 'nowrap', transition: 'all 0.15s',
                      }}
                    >
                      {deleteConfirm === r.id ? '정말 삭제?' : '삭제'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 계좌 추가 */}
        <button onClick={addRow} style={{
          display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
          padding: '10px', borderRadius: 10, border: '1px dashed var(--border-primary)',
          background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer',
          fontSize: 'var(--text-sm)', fontWeight: 600, transition: 'all 0.15s',
        }}>
          <MIcon name="add" size={16} />
          계좌 추가
        </button>
      </div>
    );
  }

  // ── 일반 보기 모드 ──
  const summaryItems = [
    { label: '총 입금액',      value: `${fmt(totals.deposit)}원`,  color: 'var(--text-primary)' },
    { label: '현재 잔액',      value: `${fmt(totals.current)}원`,  color: 'var(--text-primary)' },
    { label: '수익금',         value: `${totals.gain > 0 ? '+' : ''}${fmt(totals.gain)}원`, color: gainColor(totals.gain) },
    { label: '입금대비 수익률', value: `${totalRate > 0 ? '+' : ''}${totalRate.toFixed(2)}%`, color: gainColor(totalRate) },
  ];

  return (
    <div style={{ padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>계좌수익률</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 4 }}>
            총 입금액 대비 현재 잔액 기준 수익률
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* 오너 필터 */}
          {(['all', 'wife', 'husband', 'other'] as const).map(o => {
            const isActive = ownerFilter === o;
            const label    = o === 'all' ? '전체' : OWNER_LABEL[o];
            const color    = o === 'all' ? 'var(--text-secondary)' : OWNER_COLOR[o];
            return (
              <button key={o} onClick={() => setOwnerFilter(o)} style={{
                padding: '4px 14px', borderRadius: 20, fontSize: 'var(--text-sm)', fontWeight: 600,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: isActive
                  ? (o === 'all' ? 'var(--accent-blue)' : `color-mix(in srgb, ${color} 80%, transparent)`)
                  : `color-mix(in srgb, ${color} 12%, transparent)`,
                color: isActive ? (o === 'all' ? 'var(--accent-blue-fg)' : '#fff') : color,
              }}>{label}</button>
            );
          })}
          {/* 잔액 동기화 버튼 */}
          {rows.some(r => r.linkedAccId) && (
            <button onClick={syncBalances} disabled={syncing} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 14px', borderRadius: 20, fontSize: 'var(--text-sm)', fontWeight: 600,
              border: 'none', cursor: syncing ? 'wait' : 'pointer',
              background: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)',
              color: 'var(--accent-blue)', opacity: syncing ? 0.6 : 1,
            }}>
              <MIcon name="sync" size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
              {syncing ? '동기화 중...' : '잔액 동기화'}
            </button>
          )}
          {/* 편집 버튼 */}
          <button onClick={startEdit} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 14px', borderRadius: 20, fontSize: 'var(--text-sm)', fontWeight: 600,
            border: '1px solid var(--border-primary)', cursor: 'pointer',
            background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
          }}>
            <MIcon name="edit" size={14} />
            편집
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
        {summaryItems.map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--bg-secondary)', borderRadius: 12,
            padding: '14px 16px', border: '1px solid var(--border-primary)',
          }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 6 }}>{label}</div>
            <div className="toss-number" style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color, whiteSpace: 'nowrap' }}>
              {isAmountHidden ? '••••••' : value}
            </div>
          </div>
        ))}
      </div>

      {/* 테이블 / 모바일 카드 */}
      {isMobile ? (
        <div style={{ background: 'var(--bg-primary)', borderRadius: 16, border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
          {sorted.map((r, i) => {
            const { totalDeposit, current, gain, rate } = calcRow(r);
            const gc = gainColor(gain);
            return (
              <div key={r.id} style={{
                padding: '12px 14px',
                borderBottom: i < sorted.length - 1 ? '1px solid var(--border-primary)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                    color: '#fff', background: OWNER_COLOR[r.owner], flexShrink: 0,
                  }}>{OWNER_LABEL[r.owner]}</span>
                  <span style={{
                    fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{r.name}</span>
                  {r.linkedAccId && <MIcon name="link" size={12} style={{ color: 'var(--accent-blue)', opacity: 0.7, flexShrink: 0 }} />}
                  <span className="toss-number" style={{
                    fontSize: 'var(--text-sm)', fontWeight: 700, color: gc, padding: '2px 8px', borderRadius: 8,
                    background: `color-mix(in srgb, ${gc} 10%, transparent)`, flexShrink: 0,
                  }}>{rate > 0 ? '+' : ''}{rate.toFixed(2)}%</span>
                </div>
                {(r.before2024 > 0 || r.deposit2024 > 0 || r.deposit2025 > 0 || r.actual2026 > 0) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8, fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)' }}>
                    {r.before2024 > 0 && <span>이전 {isAmountHidden ? '••' : `${fmt(Math.round(r.before2024 / 10000))}만`}</span>}
                    {r.deposit2024 > 0 && <span>'24 {isAmountHidden ? '••' : `${fmt(Math.round(r.deposit2024 / 10000))}만`}</span>}
                    {r.deposit2025 > 0 && <span>'25 {isAmountHidden ? '••' : `${fmt(Math.round(r.deposit2025 / 10000))}만`}</span>}
                    {r.actual2026 > 0 && <span>'26 {isAmountHidden ? '••' : `${fmt(Math.round(r.actual2026 / 10000))}만`}</span>}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 'var(--text-xs)' }}>
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>입금</div>
                    <div className="toss-number" style={{ fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {isAmountHidden ? '••' : `${fmt(totalDeposit)}원`}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>잔액</div>
                    <div className="toss-number" style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {isAmountHidden ? '••' : `${fmt(current)}원`}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>수익</div>
                    <div className="toss-number" style={{ fontWeight: 700, color: gc, whiteSpace: 'nowrap' }}>
                      {isAmountHidden ? '••' : `${gain > 0 ? '+' : ''}${fmt(gain)}원`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {/* 합계 푸터 */}
          <div style={{ padding: '12px 14px', background: 'var(--bg-secondary)', borderTop: '2px solid var(--border-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>합계 ({sorted.length}개)</span>
              <span className="toss-number" style={{
                fontSize: 'var(--text-sm)', fontWeight: 700, color: gainColor(totalRate),
                padding: '2px 8px', borderRadius: 8,
                background: `color-mix(in srgb, ${gainColor(totalRate)} 10%, transparent)`,
              }}>{totalRate > 0 ? '+' : ''}{totalRate.toFixed(2)}%</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 'var(--text-xs)' }}>
              <div>
                <div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>입금</div>
                <div className="toss-number" style={{ fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {isAmountHidden ? '••' : `${fmt(totals.deposit)}원`}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>잔액</div>
                <div className="toss-number" style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  {isAmountHidden ? '••' : `${fmt(totals.current)}원`}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)', marginBottom: 2 }}>수익</div>
                <div className="toss-number" style={{ fontWeight: 700, color: gainColor(totals.gain), whiteSpace: 'nowrap' }}>
                  {isAmountHidden ? '••' : `${totals.gain > 0 ? '+' : ''}${fmt(totals.gain)}원`}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div style={{ background: 'var(--bg-primary)', borderRadius: 16, border: '1px solid var(--border-primary)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {[
                { label: '계좌',      key: null              },
                { label: '총 입금액', key: 'deposit' as SortKey },
                { label: '현재 잔액', key: 'current' as SortKey },
                { label: '수익금',    key: 'gain'    as SortKey },
                { label: '수익률',    key: 'rate'    as SortKey },
              ].map(({ label, key }) => (
                <th key={label} onClick={() => key && toggleSort(key)} style={{
                  padding: '12px 16px', fontSize: 'var(--text-xs)', fontWeight: 600,
                  color: 'var(--text-tertiary)', background: 'var(--bg-secondary)',
                  borderBottom: '1px solid var(--border-primary)',
                  textAlign: label === '계좌' ? 'left' : 'right',
                  cursor: key ? 'pointer' : 'default', whiteSpace: 'nowrap', userSelect: 'none',
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {label}{key && <SortIcon k={key} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => {
              const { totalDeposit, current, gain, rate } = calcRow(r);
              const gc = gainColor(gain);
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                        color: '#fff', background: OWNER_COLOR[r.owner],
                      }}>{OWNER_LABEL[r.owner]}</span>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
                      {r.linkedAccId && <MIcon name="link" size={12} style={{ color: 'var(--accent-blue)', opacity: 0.7 }} />}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--text-quaternary)' }}>
                      {r.before2024  > 0 && <span>이전 {isAmountHidden ? '••••' : `${fmt(Math.round(r.before2024  / 10000))}만`}</span>}
                      {r.deposit2024 > 0 && <span>'24 {isAmountHidden  ? '••••' : `${fmt(Math.round(r.deposit2024 / 10000))}만`}</span>}
                      {r.deposit2025 > 0 && <span>'25 {isAmountHidden  ? '••••' : `${fmt(Math.round(r.deposit2025 / 10000))}만`}</span>}
                      {r.actual2026  > 0 && <span>'26 {isAmountHidden  ? '••••' : `${fmt(Math.round(r.actual2026  / 10000))}만`}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                    <div className="toss-number" style={{ fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>
                      {isAmountHidden ? '••••••' : `${fmt(totalDeposit)}원`}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <div className="toss-number" style={{ fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>
                      {isAmountHidden ? '••••••' : `${fmt(current)}원`}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: gc }}>
                    <div className="toss-number" style={{ fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>
                      {isAmountHidden ? '••••' : `${gain > 0 ? '+' : ''}${fmt(gain)}원`}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>
                    <div className="toss-number" style={{
                      fontSize: 'var(--text-base)', color: gc, display: 'inline-block',
                      padding: '2px 10px', borderRadius: 8,
                      background: `color-mix(in srgb, ${gc} 10%, transparent)`,
                    }}>
                      {`${rate > 0 ? '+' : ''}${rate.toFixed(2)}%`}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border-primary)' }}>
              <td style={{ padding: '12px 16px', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
                합계 ({sorted.length}개)
              </td>
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                <div className="toss-number" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {isAmountHidden ? '••••••' : `${fmt(totals.deposit)}원`}
                </div>
              </td>
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                <div className="toss-number" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  {isAmountHidden ? '••••••' : `${fmt(totals.current)}원`}
                </div>
              </td>
              <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: gainColor(totals.gain) }}>
                <div className="toss-number" style={{ fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>
                  {isAmountHidden ? '••••' : `${totals.gain > 0 ? '+' : ''}${fmt(totals.gain)}원`}
                </div>
              </td>
              <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>
                <div className="toss-number" style={{
                  fontSize: 'var(--text-base)', color: gainColor(totalRate), display: 'inline-block',
                  padding: '2px 10px', borderRadius: 8,
                  background: `color-mix(in srgb, ${gainColor(totalRate)} 10%, transparent)`,
                }}>
                  {`${totalRate > 0 ? '+' : ''}${totalRate.toFixed(2)}%`}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      )}
    </div>
  );
}
