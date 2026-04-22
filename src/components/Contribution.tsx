import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../App';
import { kvGet, kvSet } from '../api';
import { MIcon } from './MIcon';

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
}

const SEED: AccountRow[] = [
  { id:'w1', name:'퇴직연금 IRP', owner:'wife', before2024:27000000, deposit2024:3000000, close2024:34735619, balance2025:38628835, deposit2025:3000000, actual2026:0, deposit2026:3000000 },
  { id:'w2', name:'ISA', owner:'wife', before2024:0, deposit2024:18800000, close2024:18219580, balance2025:21812075, deposit2025:0, actual2026:0, deposit2026:20000000 },
  { id:'w3', name:'펀슈 (세제)', owner:'wife', before2024:42000000, deposit2024:6000000, close2024:53884340, balance2025:72647218, deposit2025:6000000, actual2026:0, deposit2026:6000000 },
  { id:'w4', name:'한투', owner:'wife', before2024:0, deposit2024:9000000, close2024:9950376, balance2025:21951600, deposit2025:9000000, actual2026:0, deposit2026:9000000 },
  { id:'w5', name:'KB퇴직연금 IRP', owner:'wife', before2024:0, deposit2024:3000000, close2024:4227286, balance2025:6533394, deposit2025:3000000, actual2026:0, deposit2026:3000000 },
  { id:'h1', name:'오빠퇴직연금IRP', owner:'husband', before2024:12700000, deposit2024:3000000, close2024:17545387, balance2025:22340687, deposit2025:3000000, actual2026:0, deposit2026:3000000 },
  { id:'h2', name:'오빠SA 미래', owner:'husband', before2024:0, deposit2024:19000000, close2024:0, balance2025:6701364, deposit2025:6100000, actual2026:0, deposit2026:20000000 },
  { id:'h3', name:'오빠펀슈 (세제)', owner:'husband', before2024:48200000, deposit2024:4400000, close2024:61180917, balance2025:75207806, deposit2025:4400000, actual2026:0, deposit2026:4400000 },
  { id:'h4', name:'오빠미래에셋연금', owner:'husband', before2024:0, deposit2024:9000000, close2024:33501364, balance2025:51014205, deposit2025:0, actual2026:0, deposit2026:9000000 },
  { id:'w6', name:'예금', owner:'wife', before2024:0, deposit2024:0, close2024:0, balance2025:0, deposit2025:0, actual2026:0, deposit2026:0 },
  { id:'w7', name:'우리사주', owner:'wife', before2024:12071910, deposit2024:0, close2024:12071910, balance2025:11501175, deposit2025:0, actual2026:0, deposit2026:0 },
  { id:'w8', name:'퇴직연금DC', owner:'wife', before2024:49709764, deposit2024:0, close2024:60021742, balance2025:82706419, deposit2025:0, actual2026:0, deposit2026:0 },
  { id:'w9', name:'유진', owner:'wife', before2024:8938025, deposit2024:0, close2024:8938025, balance2025:8927250, deposit2025:0, actual2026:0, deposit2026:0 },
  { id:'w10', name:'키움', owner:'wife', before2024:7401710, deposit2024:0, close2024:7401710, balance2025:8044369, deposit2025:0, actual2026:0, deposit2026:0 },
  { id:'w11', name:'일드맥스', owner:'wife', before2024:0, deposit2024:0, close2024:0, balance2025:11965112, deposit2025:14000000, actual2026:0, deposit2026:0 },
  { id:'w12', name:'미래해외', owner:'wife', before2024:13881343, deposit2024:0, close2024:13421244, balance2025:11881390, deposit2025:0, actual2026:0, deposit2026:0 },
  { id:'o1', name:'비트코인', owner:'other', before2024:0, deposit2024:0, close2024:9000000, balance2025:29922411, deposit2025:23000000, actual2026:0, deposit2026:0 },
  { id:'o2', name:'기타증권', owner:'other', before2024:0, deposit2024:0, close2024:0, balance2025:13064239, deposit2025:0, actual2026:0, deposit2026:2000000 },
  { id:'h5', name:'오빠퇴직연금DC', owner:'husband', before2024:56520303, deposit2024:0, close2024:56648162, balance2025:56927615, deposit2025:0, actual2026:0, deposit2026:0 },
  { id:'h6', name:'오빠일드맥스', owner:'husband', before2024:0, deposit2024:0, close2024:0, balance2025:16151904, deposit2025:14500000, actual2026:0, deposit2026:0 },
  { id:'o3', name:'기타', owner:'other', before2024:0, deposit2024:0, close2024:0, balance2025:0, deposit2025:0, actual2026:0, deposit2026:0 },
  { id:'o4', name:'대출', owner:'other', before2024:0, deposit2024:0, close2024:0, balance2025:0, deposit2025:9000000, actual2026:0, deposit2026:12000000 },
];

const OWNER_LABELS: Record<string, string> = { wife: '지윤', husband: '오빠', other: '기타' };

type YearKey = '2026' | '2025' | '2024' | '2023';

function f(v: number, hidden: boolean) {
  if (hidden) return '••••';
  if (v === 0) return '';
  return '₩' + v.toLocaleString('ko-KR');
}
function fSigned(v: number, hidden: boolean) {
  if (hidden) return '••••';
  if (v === 0) return '';
  const sign = v > 0 ? '+' : '';
  return sign + '₩' + Math.abs(v).toLocaleString('ko-KR');
}
function parseAmt(s: string) {
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

const TH: React.CSSProperties = {
  padding: '8px 12px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)',
  background: 'var(--bg-secondary)', whiteSpace: 'nowrap', textAlign: 'right',
  borderBottom: '1px solid var(--border-primary)', position: 'sticky', top: 0, zIndex: 2,
};
const TH_LEFT: React.CSSProperties = { ...TH, textAlign: 'left', position: 'sticky', left: 0, zIndex: 3 };
const TD: React.CSSProperties = {
  padding: '9px 12px', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap', textAlign: 'right',
  borderBottom: '1px solid var(--border-secondary)', fontVariantNumeric: 'tabular-nums',
};
const TD_LEFT: React.CSSProperties = {
  ...TD, textAlign: 'left', fontWeight: 500, fontSize: 'var(--text-sm)',
  position: 'sticky', left: 0, background: 'var(--bg-primary)', zIndex: 1,
};
const TD_LEFT_ALT: React.CSSProperties = { ...TD_LEFT, background: 'var(--bg-secondary)' };

export function Contribution() {
  const { isAmountHidden, isMobile } = useAppContext();
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'wife' | 'husband' | 'other'>('all');
  const [visibleYears, setVisibleYears] = useState<Set<YearKey>>(new Set(['2026', '2025']));
  const [editing, setEditing] = useState(false);
  const [editRows, setEditRows] = useState<AccountRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    kvGet<AccountRow[]>('contributions_v2').then(d => {
      if (d && d.length > 0) {
        // migrate: add actual2026 if missing
        const migrated = d.map(r => ({ actual2026: 0, ...r }));
        setRows(migrated);
      } else {
        setRows(SEED);
        kvSet('contributions_v2', SEED);
      }
    });
  }, []);

  const toggleYear = (y: YearKey) => {
    setVisibleYears(prev => {
      const next = new Set(prev);
      if (next.has(y)) {
        if (next.size > 1) next.delete(y); // 최소 1개 유지
      } else {
        next.add(y);
      }
      return next;
    });
  };

  const filtered = useMemo(() =>
    ownerFilter === 'all' ? rows : rows.filter(r => r.owner === ownerFilter),
    [rows, ownerFilter]
  );

  const totals = useMemo(() => {
    const s = (arr: AccountRow[], key: keyof AccountRow) => arr.reduce((a, r) => a + (r[key] as number), 0);
    return {
      before2024: s(filtered, 'before2024'),
      deposit2024: s(filtered, 'deposit2024'),
      close2024: s(filtered, 'close2024'),
      balance2025: s(filtered, 'balance2025'),
      deposit2025: s(filtered, 'deposit2025'),
      actual2026: s(filtered, 'actual2026'),
      deposit2026: s(filtered, 'deposit2026'),
    };
  }, [filtered]);

  const startEdit = () => { setEditRows(rows.map(r => ({ ...r }))); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setEditRows([]); };
  const saveEdit = async () => {
    setSaving(true);
    setRows(editRows);
    await kvSet('contributions_v2', editRows);
    setSaving(false);
    setEditing(false);
  };
  const updateCell = (id: string, field: keyof AccountRow, val: string) => {
    setEditRows(prev => prev.map(r => r.id === id ? { ...r, [field]: parseAmt(val) } : r));
  };

  const displayFiltered = editing
    ? (ownerFilter === 'all' ? editRows : editRows.filter(r => r.owner === ownerFilter))
    : filtered;

  const show2026 = visibleYears.has('2026');
  const show2025 = visibleYears.has('2025');
  const show2024 = visibleYears.has('2024');
  const show2023 = visibleYears.has('2023');

  const inputStyle: React.CSSProperties = {
    width: 90, padding: '3px 6px', fontSize: 'var(--text-xs)', textAlign: 'right',
    background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
    borderRadius: 4, color: 'var(--text-primary)', outline: 'none',
    fontVariantNumeric: 'tabular-nums',
  };

  const yearBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 20, fontSize: 'var(--text-xs)', fontWeight: 600,
    border: active ? 'none' : '1px solid var(--border-primary)',
    cursor: 'pointer', transition: 'all 0.15s',
    background: active ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
    color: active ? 'var(--accent-blue-fg)' : 'var(--text-tertiary)',
  });

  const BL = '2px solid var(--border-primary)';
  const BLS = '2px solid var(--border-secondary)';

  return (
    <div style={{ padding: isMobile ? '16px' : '24px', height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>납입</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {!editing ? (
            <button onClick={startEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer' }}>
              <MIcon name="edit" size={13} /> 편집
            </button>
          ) : (
            <>
              <button onClick={cancelEdit} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer' }}>
                <MIcon name="close" size={13} /> 취소
              </button>
              <button onClick={saveEdit} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--accent-blue)', color: 'var(--accent-blue-fg)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer' }}>
                <MIcon name="check" size={13} /> {saving ? '저장 중...' : '저장'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10 }}>
        {[
          { label: '2023 이전', val: totals.before2024 },
          { label: '2024 입금', val: totals.deposit2024 },
          { label: '2025 입금', val: totals.deposit2025 },
          { label: '2026 계획', val: totals.deposit2026 },
        ].map(({ label, val }) => (
          <div key={label} className="toss-card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {f(val, isAmountHidden) || '—'}
            </div>
          </div>
        ))}
      </div>

      {/* 필터 행: 소유자 + 연도 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {/* 소유자 */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'wife', 'husband', 'other'] as const).map(o => (
            <button key={o} onClick={() => setOwnerFilter(o)}
              style={{ padding: '6px 16px', borderRadius: 20, fontSize: 'var(--text-sm)', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: ownerFilter === o ? 'var(--accent-blue)' : 'var(--bg-tertiary)', color: ownerFilter === o ? 'var(--accent-blue-fg)' : 'var(--text-secondary)' }}
            >
              {o === 'all' ? '전체' : o === 'wife' ? '👩 지윤' : o === 'husband' ? '👨 오빠' : '기타'}
            </button>
          ))}
        </div>
        {/* 구분선 */}
        <div style={{ width: 1, height: 24, background: 'var(--border-primary)' }} />
        {/* 연도 토글 */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginRight: 2 }}>연도</span>
          {(['2026', '2025', '2024', '2023'] as YearKey[]).map(y => (
            <button key={y} onClick={() => toggleYear(y)} style={yearBtnStyle(visibleYears.has(y))}>
              {y === '2023' ? '~2023' : y}
            </button>
          ))}
        </div>
      </div>

      {/* 테이블 */}
      <div style={{ overflow: 'auto', flex: 1, border: '1px solid var(--border-primary)', borderRadius: 12 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 200 }}>
          <thead>
            <tr>
              <th style={{ ...TH_LEFT, minWidth: 130 }}>계좌</th>
              {show2026 && <>
                <th style={{ ...TH, borderLeft: BL }}>2026 입금액</th>
                <th style={TH}>2026 계획</th>
              </>}
              {show2025 && <>
                <th style={{ ...TH, borderLeft: BL }}>2025 현재잔액</th>
                <th style={TH}>2025 입금액</th>
              </>}
              {show2024 && <>
                <th style={{ ...TH, borderLeft: BL }}>2024 입금액</th>
                <th style={TH}>2024 예상액</th>
                <th style={TH}>2024 마감잔액</th>
                <th style={TH}>±계획</th>
                <th style={TH}>2023대비↑</th>
              </>}
              {show2023 && <th style={{ ...TH, borderLeft: BL }}>2023 이전</th>}
            </tr>
          </thead>
          <tbody>
            {displayFiltered.map((row, i) => {
              const expected2024 = row.before2024 + row.deposit2024;
              const planDiff = row.close2024 - expected2024;
              const growth = row.close2024 - row.before2024;
              const isAlt = i % 2 !== 0;
              const tdName = isAlt ? TD_LEFT_ALT : TD_LEFT;
              const td: React.CSSProperties = { ...TD, color: 'var(--text-primary)', background: isAlt ? 'var(--bg-secondary)' : 'transparent' };
              const tdMuted: React.CSSProperties = { ...TD, color: 'var(--text-tertiary)', background: isAlt ? 'var(--bg-secondary)' : 'transparent' };
              const tdPos: React.CSSProperties = { ...td, color: 'var(--color-profit)' };
              const tdNeg: React.CSSProperties = { ...td, color: 'var(--color-loss)' };

              return (
                <tr key={row.id}>
                  <td style={tdName}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: row.owner === 'wife' ? 'var(--color-profit)' : row.owner === 'husband' ? 'var(--accent-blue)' : 'var(--text-tertiary)', background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>
                        {OWNER_LABELS[row.owner]}
                      </span>
                      {row.name}
                    </span>
                  </td>
                  {show2026 && <>
                    <td style={{ ...td, borderLeft: BLS }}>
                      {editing ? <input style={inputStyle} defaultValue={row.actual2026 || ''} onBlur={e => updateCell(row.id, 'actual2026', e.target.value)} /> : f(row.actual2026, isAmountHidden)}
                    </td>
                    <td style={tdMuted}>
                      {editing ? <input style={inputStyle} defaultValue={row.deposit2026 || ''} onBlur={e => updateCell(row.id, 'deposit2026', e.target.value)} /> : f(row.deposit2026, isAmountHidden)}
                    </td>
                  </>}
                  {show2025 && <>
                    <td style={{ ...td, borderLeft: BLS }}>
                      {editing ? <input style={inputStyle} defaultValue={row.balance2025 || ''} onBlur={e => updateCell(row.id, 'balance2025', e.target.value)} /> : f(row.balance2025, isAmountHidden)}
                    </td>
                    <td style={td}>
                      {editing ? <input style={inputStyle} defaultValue={row.deposit2025 || ''} onBlur={e => updateCell(row.id, 'deposit2025', e.target.value)} /> : f(row.deposit2025, isAmountHidden)}
                    </td>
                  </>}
                  {show2024 && <>
                    <td style={{ ...td, borderLeft: BLS }}>
                      {editing ? <input style={inputStyle} defaultValue={row.deposit2024 || ''} onBlur={e => updateCell(row.id, 'deposit2024', e.target.value)} /> : f(row.deposit2024, isAmountHidden)}
                    </td>
                    <td style={tdMuted}>{f(expected2024, isAmountHidden)}</td>
                    <td style={td}>
                      {editing ? <input style={inputStyle} defaultValue={row.close2024 || ''} onBlur={e => updateCell(row.id, 'close2024', e.target.value)} /> : f(row.close2024, isAmountHidden)}
                    </td>
                    <td style={planDiff > 0 ? tdPos : planDiff < 0 ? tdNeg : tdMuted}>{fSigned(planDiff, isAmountHidden)}</td>
                    <td style={growth > 0 ? tdPos : growth < 0 ? tdNeg : tdMuted}>{fSigned(growth, isAmountHidden)}</td>
                  </>}
                  {show2023 && <td style={{ ...tdMuted, borderLeft: BLS }}>{f(row.before2024, isAmountHidden)}</td>}
                </tr>
              );
            })}
          </tbody>
          {/* 합계 행 */}
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
              <td style={{ ...TD_LEFT, fontWeight: 700, color: 'var(--text-primary)', background: 'var(--bg-secondary)' }}>합계</td>
              {show2026 && <>
                <td style={{ ...TD, fontWeight: 700, color: 'var(--text-primary)', borderLeft: BL }}>{f(totals.actual2026, isAmountHidden)}</td>
                <td style={{ ...TD, color: 'var(--text-tertiary)' }}>{f(totals.deposit2026, isAmountHidden)}</td>
              </>}
              {show2025 && <>
                <td style={{ ...TD, fontWeight: 700, color: 'var(--text-primary)', borderLeft: BL }}>{f(totals.balance2025, isAmountHidden)}</td>
                <td style={{ ...TD, fontWeight: 700, color: 'var(--text-primary)' }}>{f(totals.deposit2025, isAmountHidden)}</td>
              </>}
              {show2024 && <>
                <td style={{ ...TD, fontWeight: 700, color: 'var(--text-primary)', borderLeft: BL }}>{f(totals.deposit2024, isAmountHidden)}</td>
                <td style={{ ...TD, color: 'var(--text-tertiary)' }}>{f(totals.before2024 + totals.deposit2024, isAmountHidden)}</td>
                <td style={{ ...TD, fontWeight: 700, color: 'var(--text-primary)' }}>{f(totals.close2024, isAmountHidden)}</td>
                <td style={{ ...TD, fontWeight: 700, color: totals.close2024 - totals.before2024 - totals.deposit2024 >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                  {fSigned(totals.close2024 - totals.before2024 - totals.deposit2024, isAmountHidden)}
                </td>
                <td style={{ ...TD, fontWeight: 700, color: 'var(--color-profit)' }}>{fSigned(totals.close2024 - totals.before2024, isAmountHidden)}</td>
              </>}
              {show2023 && <td style={{ ...TD, fontWeight: 700, color: 'var(--text-primary)', borderLeft: BL }}>{f(totals.before2024, isAmountHidden)}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
