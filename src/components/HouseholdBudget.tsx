import React, { useState, useEffect } from 'react';
import { kvGet, kvSet } from '../api';
import { MIcon } from './MIcon';
import { useAppContext } from '../App';

type ItemType = 'income' | 'fixed' | 'variable';

interface BudgetItem {
  id: string;
  type: ItemType;
  name: string;
  budget: number | null;
  actual: number | null;
}

interface BudgetData {
  items: BudgetItem[];
}

// ── 시드 데이터 ────────────────────────────────────────────────
const SEED_2026_04: Omit<BudgetItem, 'id'>[] = [
  // 수입
  { type: 'income', name: '지윤 급여',   budget: null, actual: null },
  { type: 'income', name: '오빠 급여',   budget: null, actual: null },
  { type: 'income', name: '사업자 소득', budget: null, actual: null },
  { type: 'income', name: '부수입',      budget: null, actual: null },
  // 고정 지출
  { type: 'fixed', name: '노랑우산',     budget: 250000,  actual: null    },
  { type: 'fixed', name: '인터넷',       budget: 55230,   actual: 44000   },
  { type: 'fixed', name: 'TV',           budget: 0,       actual: 0       },
  { type: 'fixed', name: '오빠휴대폰',   budget: 21000,   actual: 25000   },
  { type: 'fixed', name: '지윤휴대폰',   budget: 100000,  actual: 25000   },
  { type: 'fixed', name: '오빠실비',     budget: 71839,   actual: 55897   },
  { type: 'fixed', name: 'JY실비',       budget: 69020,   actual: 69020   },
  { type: 'fixed', name: 'JY암',         budget: 28000,   actual: 28000   },
  { type: 'fixed', name: '오빠암보험',   budget: 32000,   actual: 32000   },
  { type: 'fixed', name: '운전자보험',   budget: 13350,   actual: 13350   },
  { type: 'fixed', name: 'JY보험(K)1',  budget: 12672,   actual: 12672   },
  { type: 'fixed', name: 'JY보험(K)2',  budget: 10140,   actual: 10140   },
  { type: 'fixed', name: '주택화재보험', budget: 9900,    actual: 9900    },
  { type: 'fixed', name: 'JY독감보험',   budget: 10140,   actual: 10140   },
  { type: 'fixed', name: '오빠치아보험', budget: 30700,   actual: 30700   },
  { type: 'fixed', name: '어머님실비',   budget: 161684,  actual: 161684  },
  { type: 'fixed', name: '엄마실비',     budget: 123610,  actual: 123610  },
  { type: 'fixed', name: '엄마암',       budget: 33000,   actual: 33000   },
  { type: 'fixed', name: '양압기',       budget: 15200,   actual: 41600   },
  { type: 'fixed', name: '대출',         budget: 930000,  actual: null    },
  { type: 'fixed', name: '용돈',         budget: 850000,  actual: 850000  },
  // 변동 지출
  { type: 'variable', name: '도시가스',  budget: 50000,   actual: 119880  },
  { type: 'variable', name: '관리비',    budget: 200000,  actual: 183270  },
  { type: 'variable', name: '대중교통',  budget: 100000,  actual: 55700   },
  { type: 'variable', name: '하이패스',  budget: 300000,  actual: 73400   },
  { type: 'variable', name: '구독료',    budget: 20000,   actual: 24390   },
  { type: 'variable', name: '자동차세',  budget: 500000,  actual: 476290  },
  { type: 'variable', name: '식비/외식', budget: 300000,  actual: null    },
  { type: 'variable', name: '쇼핑',      budget: 200000,  actual: null    },
  { type: 'variable', name: '의료/약국', budget: 50000,   actual: null    },
  { type: 'variable', name: '기타',      budget: 100000,  actual: null    },
];

function genId() { return Math.random().toString(36).slice(2, 10); }
function kvKey(ym: string) { return `budget2_${ym.replace('-', '_')}`; }

function fmtKrw(v: number | null): string {
  if (v === null || v === undefined) return '—';
  return `₩${Math.abs(v).toLocaleString()}`;
}
function fmtDiff(v: number | null): string {
  if (v === null) return '—';
  if (v === 0) return '₩0';
  return v > 0 ? `+₩${v.toLocaleString()}` : `-₩${Math.abs(v).toLocaleString()}`;
}
function diffColor(v: number | null): string {
  if (v === null) return 'var(--text-tertiary)';
  if (v > 0) return 'var(--color-profit)';
  if (v < 0) return 'var(--color-loss)';
  return 'var(--text-tertiary)';
}
function parseNum(s: string): number | null {
  const n = Number(s.replace(/,/g, '').trim());
  return s.trim() === '' || isNaN(n) ? null : n;
}

const SECTION_CONFIG: Record<ItemType, { label: string; icon: string; accentColor: string }> = {
  income:   { label: '수입',     icon: 'payments',    accentColor: 'var(--color-profit)' },
  fixed:    { label: '고정 지출', icon: 'lock',        accentColor: 'var(--accent-blue)'  },
  variable: { label: '변동 지출', icon: 'swap_vert',   accentColor: 'var(--color-warning)' },
};

// ── 섹션별 테이블 ──────────────────────────────────────────────
function BudgetSection({
  type, items, isMobile, onEdit, onDelete, onAdd,
}: {
  type: ItemType;
  items: BudgetItem[];
  isMobile: boolean;
  onEdit: (item: BudgetItem) => void;
  onDelete: (id: string) => void;
  onAdd: (type: ItemType) => void;
}) {
  const cfg = SECTION_CONFIG[type];
  const isIncome = type === 'income';

  const totalBudget = items.reduce((s, i) => s + (i.budget ?? 0), 0);
  const totalActual = items.reduce((s, i) => s + (i.actual ?? 0), 0);
  const diff = isIncome ? (totalActual - totalBudget) : (totalBudget - totalActual);

  const th: React.CSSProperties = {
    padding: isMobile ? '7px 8px' : '9px 14px',
    textAlign: 'right', fontWeight: 600, fontSize: 'var(--text-xs)',
    color: 'var(--text-tertiary)', background: 'var(--bg-secondary)',
    whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-primary)',
  };
  const td: React.CSSProperties = {
    padding: isMobile ? '8px 8px' : '10px 14px',
    textAlign: 'right', fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)', borderBottom: '1px solid var(--border-secondary)',
    whiteSpace: 'nowrap',
  };

  return (
    <div>
      {/* 섹션 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'var(--bg-secondary)',
        borderRadius: items.length === 0 ? 12 : '12px 12px 0 0',
        border: '1px solid var(--border-primary)',
        borderBottom: items.length === 0 ? '1px solid var(--border-primary)' : '1px solid var(--border-primary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `color-mix(in srgb, ${cfg.accentColor} 15%, transparent)`,
            color: cfg.accentColor, flexShrink: 0,
          }}>
            <MIcon name={cfg.icon} size={15} />
          </span>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{cfg.label}</span>
          {items.length > 0 && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{items.length}건</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {items.length > 0 && (
            <div style={{ display: 'flex', gap: isMobile ? 6 : 16, fontSize: 'var(--text-xs)', alignItems: 'center' }}>
              {!isIncome && (
                <span style={{ color: 'var(--text-tertiary)' }}>
                  예산 <span className="toss-number" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{fmtKrw(totalBudget)}</span>
                </span>
              )}
              <span style={{ color: 'var(--text-tertiary)' }}>
                {isIncome ? '수입' : '지출'} <span className="toss-number" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{fmtKrw(totalActual)}</span>
              </span>
              {items.some(i => i.actual !== null) && (
                <span className="toss-number" style={{ color: diffColor(diff), fontWeight: 700 }}>{fmtDiff(diff)}</span>
              )}
            </div>
          )}
          <button
            onClick={() => onAdd(type)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: `color-mix(in srgb, ${cfg.accentColor} 12%, transparent)`,
              color: cfg.accentColor,
              fontSize: 'var(--text-xs)', fontWeight: 600,
            }}
          >
            <MIcon name="add" size={14} />
            {!isMobile && '추가'}
          </button>
        </div>
      </div>

      {/* 테이블 */}
      {items.length > 0 && (
        <div style={{ border: '1px solid var(--border-primary)', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>항목</th>
                {!isIncome && <th style={th}>예산</th>}
                <th style={th}>{isIncome ? '수입액' : '실지출'}</th>
                {!isIncome && <th style={th}>차액</th>}
                <th style={{ ...th, width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const diff = (!isIncome && item.budget !== null && item.actual !== null)
                  ? item.budget - item.actual : null;
                return (
                  <tr
                    key={item.id}
                    onClick={() => onEdit(item)}
                    style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...td, textAlign: 'left', fontWeight: 500 }}>{item.name}</td>
                    {!isIncome && <td style={td} className="toss-number">{fmtKrw(item.budget)}</td>}
                    <td style={{
                      ...td,
                      color: isIncome && item.actual ? 'var(--color-profit)' : undefined,
                      fontWeight: isIncome && item.actual ? 600 : 400,
                    }} className="toss-number">
                      {fmtKrw(item.actual)}
                    </td>
                    {!isIncome && (
                      <td style={{ ...td, color: diffColor(diff), fontWeight: diff !== null && diff !== 0 ? 600 : 400 }} className="toss-number">
                        {diff !== null ? fmtDiff(diff) : '—'}
                      </td>
                    )}
                    <td style={{ ...td, padding: '8px 6px', textAlign: 'center' }}>
                      <button
                        onClick={e => { e.stopPropagation(); onDelete(item.id); }}
                        style={{ padding: 4, borderRadius: 4, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--text-tertiary)', display: 'inline-flex', opacity: 0.45 }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--color-loss)'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '0.45'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                      >
                        <MIcon name="delete_outline" size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* 소계 */}
            <tfoot>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <td style={{ ...td, textAlign: 'left', fontWeight: 700, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)', borderBottom: 'none' }}>소계</td>
                {!isIncome && <td style={{ ...td, fontWeight: 700, borderTop: '1px solid var(--border-primary)', borderBottom: 'none' }} className="toss-number">{fmtKrw(totalBudget)}</td>}
                <td style={{ ...td, fontWeight: 700, color: isIncome ? 'var(--color-profit)' : undefined, borderTop: '1px solid var(--border-primary)', borderBottom: 'none' }} className="toss-number">{fmtKrw(totalActual)}</td>
                {!isIncome && <td style={{ ...td, fontWeight: 700, color: diffColor(diff), borderTop: '1px solid var(--border-primary)', borderBottom: 'none' }} className="toss-number">{fmtDiff(diff)}</td>}
                <td style={{ ...td, borderTop: '1px solid var(--border-primary)', borderBottom: 'none' }}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export function HouseholdBudget() {
  const { isMobile } = useAppContext();

  const todayYM = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const [yearMonth, setYearMonth] = useState(todayYM);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formType, setFormType] = useState<ItemType>('variable');
  const [formName, setFormName] = useState('');
  const [formBudget, setFormBudget] = useState('');
  const [formActual, setFormActual] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = async (ym: string) => {
    setLoading(true);
    try {
      const data = await kvGet<BudgetData>(kvKey(ym));
      if (data?.items?.length) { setItems(data.items); setLoading(false); return; }
    } catch { /* ignore */ }
    const local = localStorage.getItem(kvKey(ym));
    if (local) {
      try {
        const data = JSON.parse(local) as BudgetData;
        if (data.items?.length) { setItems(data.items); setLoading(false); return; }
      } catch { /* ignore */ }
    }
    if (ym === '2026-04') {
      const seeded = SEED_2026_04.map(item => ({ ...item, id: genId() }));
      setItems(seeded);
      await persistData(ym, seeded);
    } else {
      setItems([]);
    }
    setLoading(false);
  };

  const persistData = async (ym: string, newItems: BudgetItem[]) => {
    const data: BudgetData = { items: newItems };
    localStorage.setItem(kvKey(ym), JSON.stringify(data));
    setSaving(true);
    try { await kvSet(kvKey(ym), data); } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  useEffect(() => { loadData(yearMonth); }, [yearMonth]);

  const shiftMonth = (delta: number) => {
    const [y, m] = yearMonth.split('-').map(Number);
    let nm = m + delta, ny = y;
    if (nm < 1) { nm = 12; ny--; }
    if (nm > 12) { nm = 1; ny++; }
    setYearMonth(`${ny}-${String(nm).padStart(2, '0')}`);
  };

  const openAdd = (type: ItemType) => {
    setEditId(null); setFormType(type);
    setFormName(''); setFormBudget(''); setFormActual('');
    setModalOpen(true);
  };
  const openEdit = (item: BudgetItem) => {
    setEditId(item.id); setFormType(item.type);
    setFormName(item.name);
    setFormBudget(item.budget !== null ? String(item.budget) : '');
    setFormActual(item.actual !== null ? String(item.actual) : '');
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditId(null); };

  const handleSave = async () => {
    if (!formName.trim()) return;
    const budget = parseNum(formBudget);
    const actual = parseNum(formActual);
    let newItems: BudgetItem[];
    if (editId) {
      newItems = items.map(i => i.id === editId ? { ...i, type: formType, name: formName.trim(), budget, actual } : i);
    } else {
      newItems = [...items, { id: genId(), type: formType, name: formName.trim(), budget, actual }];
    }
    setItems(newItems);
    await persistData(yearMonth, newItems);
    closeModal();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const newItems = items.filter(i => i.id !== deleteId);
    setItems(newItems);
    await persistData(yearMonth, newItems);
    setDeleteId(null);
  };

  // 합계
  const totalIncome   = items.filter(i => i.type === 'income').reduce((s, i) => s + (i.actual ?? 0), 0);
  const totalFixed    = items.filter(i => i.type === 'fixed').reduce((s, i) => s + (i.actual ?? 0), 0);
  const totalVariable = items.filter(i => i.type === 'variable').reduce((s, i) => s + (i.actual ?? 0), 0);
  const totalExpense  = totalFixed + totalVariable;
  const balance       = totalIncome - totalExpense;
  const totalFixedBudget    = items.filter(i => i.type === 'fixed').reduce((s, i) => s + (i.budget ?? 0), 0);
  const totalVariableBudget = items.filter(i => i.type === 'variable').reduce((s, i) => s + (i.budget ?? 0), 0);

  return (
    <div style={{ padding: isMobile ? '16px' : '24px' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>가계부</h2>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>수입 · 고정지출 · 변동지출</p>
        </div>
        {saving && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>저장 중…</span>}
      </div>

      {/* 월 선택 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
        background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 16px',
        width: 'fit-content', border: '1px solid var(--border-primary)',
      }}>
        <button onClick={() => shiftMonth(-1)} style={{ padding: 4, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
          <MIcon name="chevron_left" size={20} />
        </button>
        <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', minWidth: 80, textAlign: 'center' }}>
          {yearMonth.replace('-', '년 ')}월
        </span>
        <button onClick={() => shiftMonth(1)} style={{ padding: 4, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
          <MIcon name="chevron_right" size={20} />
        </button>
      </div>

      {/* 요약 카드 */}
      {!loading && items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { label: '총 수입',    value: fmtKrw(totalIncome || null),   color: 'var(--color-profit)',  icon: 'payments',              sub: undefined },
            { label: '고정 지출',  value: fmtKrw(totalFixed || null),    color: 'var(--accent-blue)',   icon: 'lock',                  sub: `예산 ${fmtKrw(totalFixedBudget)}` },
            { label: '변동 지출',  value: fmtKrw(totalVariable || null), color: 'var(--color-warning)', icon: 'swap_vert',             sub: `예산 ${fmtKrw(totalVariableBudget)}` },
            { label: '잔액',       value: totalIncome ? fmtDiff(balance) : '—', color: diffColor(balance), icon: 'account_balance_wallet', sub: undefined },
          ].map(card => (
            <div key={card.label} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <MIcon name={card.icon} size={13} style={{ color: card.color }} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{card.label}</span>
              </div>
              <div className="toss-number" style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: card.color }}>{card.value}</div>
              {card.sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 3 }}>{card.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* 섹션들 */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>불러오는 중…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(['income', 'fixed', 'variable'] as ItemType[]).map(type => (
            <BudgetSection
              key={type}
              type={type}
              items={items.filter(i => i.type === type)}
              isMobile={isMobile}
              onEdit={openEdit}
              onDelete={id => setDeleteId(id)}
              onAdd={openAdd}
            />
          ))}
        </div>
      )}

      {/* 모달 */}
      {modalOpen && (
        <>
          <div onClick={closeModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: 'var(--bg-elevated)', borderRadius: 16, padding: 24,
            width: isMobile ? 'calc(100vw - 32px)' : 360,
            boxShadow: '0 8px 40px rgba(0,0,0,0.4)', border: '1px solid var(--border-primary)',
            zIndex: 101, display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {editId ? '항목 수정' : '항목 추가'}
              </h3>
              <button onClick={closeModal} style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
                <MIcon name="close" size={18} />
              </button>
            </div>

            {/* 분류 선택 */}
            <div style={{ display: 'flex', gap: 6 }}>
              {(['income', 'fixed', 'variable'] as ItemType[]).map(t => {
                const cfg = SECTION_CONFIG[t];
                const active = formType === t;
                return (
                  <button key={t} onClick={() => setFormType(t)} style={{
                    flex: 1, padding: '7px 4px', borderRadius: 8,
                    border: `1px solid ${active ? cfg.accentColor : 'var(--border-primary)'}`,
                    background: active ? `color-mix(in srgb, ${cfg.accentColor} 12%, transparent)` : 'transparent',
                    color: active ? cfg.accentColor : 'var(--text-tertiary)',
                    fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  }}>
                    <MIcon name={cfg.icon} size={16} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            {/* 항목명 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>항목명</label>
              <input autoFocus type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="예: 관리비"
                style={{ padding: '9px 12px', borderRadius: 8, fontSize: 'var(--text-sm)', border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }} />
            </div>

            {/* 예산 (수입은 숨김) */}
            {formType !== 'income' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>예산 (원)</label>
                <input type="number" value={formBudget} onChange={e => setFormBudget(e.target.value)} placeholder="예: 200000"
                  style={{ padding: '9px 12px', borderRadius: 8, fontSize: 'var(--text-sm)', border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }} />
              </div>
            )}

            {/* 실제 금액 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {formType === 'income' ? '수입액 (원)' : '실지출 (원)'}
              </label>
              <input type="number" value={formActual} onChange={e => setFormActual(e.target.value)} placeholder="예: 183270"
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                style={{ padding: '9px 12px', borderRadius: 8, fontSize: 'var(--text-sm)', border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={closeModal} className="toss-btn toss-btn-secondary" style={{ fontSize: 'var(--text-sm)', padding: '8px 16px' }}>취소</button>
              <button onClick={handleSave} disabled={!formName.trim()} style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                cursor: formName.trim() ? 'pointer' : 'default',
                background: formName.trim() ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                color: formName.trim() ? 'var(--accent-blue-fg)' : 'var(--text-tertiary)',
                fontSize: 'var(--text-sm)', fontWeight: 600,
              }}>저장</button>
            </div>
          </div>
        </>
      )}

      {/* 삭제 확인 */}
      {deleteId && (
        <>
          <div onClick={() => setDeleteId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: 'var(--bg-elevated)', borderRadius: 16, padding: 24,
            width: isMobile ? 'calc(100vw - 32px)' : 300,
            boxShadow: '0 8px 40px rgba(0,0,0,0.4)', border: '1px solid var(--border-primary)',
            zIndex: 101, display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)', fontWeight: 600 }}>항목을 삭제할까요?</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              「{items.find(i => i.id === deleteId)?.name}」을(를) 삭제합니다.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} className="toss-btn toss-btn-secondary" style={{ fontSize: 'var(--text-sm)', padding: '8px 16px' }}>취소</button>
              <button onClick={handleDelete} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'var(--color-loss)', color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 600,
              }}>삭제</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
