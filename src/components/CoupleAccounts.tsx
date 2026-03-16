import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Edit3, Save, X, ChevronDown, ChevronUp,
  RefreshCw, Building2, Briefcase, PiggyBank, Wallet,
  Calculator, Banknote, Delete
} from "lucide-react";
import { useAppContext } from "../App";
import { saveAccounts } from "../api";
import type { Account, Holding, OtherAsset } from "../types";
import { holdingValue, holdingCost } from "../types";

const ACCOUNT_TYPES = ['일반', 'ISA', '연금저축', 'IRP', 'CMA', '퇴직연금'];
const INSTITUTIONS = ['미래에셋증권', '한국투자증권', '삼성증권', 'KB증권', 'NH투자증권', '토스증권', '카카오페이증권', '기타'];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('ko-KR');
}

function AccountTypeIcon({ type }: { type: string }) {
  const cls = "w-4 h-4";
  if (type.includes('연금') || type.includes('IRP') || type.includes('퇴직')) return <PiggyBank className={cls} />;
  if (type.includes('ISA')) return <Briefcase className={cls} />;
  return <Building2 className={cls} />;
}

/* ── 종목 추가/수정 폼 ── */
function HoldingForm({
  holding,
  onSave,
  onCancel,
}: {
  holding?: Holding;
  onSave: (h: Omit<Holding, 'id'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(holding?.name || '');
  const [ticker, setTicker] = useState(holding?.ticker || '');
  const [market, setMarket] = useState<'KR' | 'US'>(holding?.market || 'US');
  const [avgPrice, setAvgPrice] = useState(holding?.avgPrice?.toString() || '');
  const [quantity, setQuantity] = useState(holding?.quantity?.toString() || '');

  const submit = () => {
    if (!name.trim() || !avgPrice || !quantity) return;
    onSave({ name: name.trim(), ticker: ticker.trim(), market, avgPrice: parseFloat(avgPrice), quantity: parseFloat(quantity) });
  };

  return (
    <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
      <Field label="종목명 *" w="flex-1 min-w-[120px]">
        <input className="toss-input" value={name} onChange={e => setName(e.target.value)} placeholder="예: SCHD" />
      </Field>
      <Field label="티커" w="w-[100px]">
        <input className="toss-input" value={ticker} onChange={e => setTicker(e.target.value)} placeholder="SCHD" />
      </Field>
      <Field label="시장" w="w-[80px]">
        <select className="toss-select w-full" value={market} onChange={e => setMarket(e.target.value as 'KR' | 'US')}>
          <option value="KR">한국</option>
          <option value="US">미국</option>
        </select>
      </Field>
      <Field label="평단가 *" w="w-[120px]">
        <input className="toss-input" type="number" value={avgPrice} onChange={e => setAvgPrice(e.target.value)} placeholder="0" />
      </Field>
      <Field label="수량 *" w="w-[90px]">
        <input className="toss-input" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" />
      </Field>
      <div className="flex gap-1.5">
        <button onClick={submit} className="toss-btn toss-btn-primary" style={{ padding: '8px 14px', fontSize: '13px' }}>
          <Save className="w-3.5 h-3.5" />{holding ? '수정' : '추가'}
        </button>
        <button onClick={onCancel} className="toss-btn toss-btn-ghost" style={{ padding: '8px 10px' }}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ── 펀드 추가/수정 폼 ── */
function FundForm({
  fund,
  onSave,
  onCancel,
}: {
  fund?: Holding;
  onSave: (name: string, amount: number) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(fund?.name || '');
  const [amount, setAmount] = useState(fund?.amount?.toString() || '');

  const submit = () => {
    if (!name.trim() || !amount) return;
    onSave(name.trim(), parseFloat(amount));
  };

  return (
    <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
      <Field label="펀드명 *" w="flex-1 min-w-[160px]">
        <input className="toss-input" value={name} onChange={e => setName(e.target.value)} placeholder="예: 미래에셋글로벌펀드" />
      </Field>
      <Field label="금액 *" w="w-[180px]">
        <input className="toss-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
      </Field>
      <div className="flex gap-1.5">
        <button onClick={submit} className="toss-btn toss-btn-primary" style={{ padding: '8px 14px', fontSize: '13px' }}>
          <Save className="w-3.5 h-3.5" />{fund ? '수정' : '추가'}
        </button>
        <button onClick={onCancel} className="toss-btn toss-btn-ghost" style={{ padding: '8px 10px' }}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function Field({ label, w, children }: { label: string; w: string; children: React.ReactNode }) {
  return (
    <div className={w}>
      <label className="block mb-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

/* ── 계산기 모달 ── */
function CalculatorModal({ onClose, onApply, initialValue }: {
  onClose: () => void;
  onApply: (value: number) => void;
  initialValue: number;
}) {
  const [display, setDisplay] = useState(initialValue ? initialValue.toString() : '0');
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [resetNext, setResetNext] = useState(false);

  const handleNum = (n: string) => {
    if (resetNext) { setDisplay(n); setResetNext(false); }
    else setDisplay(display === '0' ? n : display + n);
  };

  const handleOp = (newOp: string) => {
    const cur = parseFloat(display);
    if (prev !== null && op && !resetNext) {
      const result = calc(prev, cur, op);
      setDisplay(String(result));
      setPrev(result);
    } else {
      setPrev(cur);
    }
    setOp(newOp);
    setResetNext(true);
  };

  const calc = (a: number, b: number, operator: string): number => {
    switch (operator) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b !== 0 ? a / b : 0;
      default: return b;
    }
  };

  const handleEqual = () => {
    if (prev !== null && op) {
      const result = calc(prev, parseFloat(display), op);
      setDisplay(String(result));
      setPrev(null);
      setOp(null);
      setResetNext(true);
    }
  };

  const handleClear = () => { setDisplay('0'); setPrev(null); setOp(null); };
  const handleBackspace = () => setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
  const [pasteMsg, setPasteMsg] = useState('');

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const cleaned = text.replace(/[^0-9.\-]/g, '');
      const num = parseFloat(cleaned);
      if (!isNaN(num)) {
        setDisplay(String(num));
        setResetNext(false);
        setPasteMsg('붙여넣기 완료');
        setTimeout(() => setPasteMsg(''), 1500);
      }
    } catch {
      setPasteMsg('클립보드 접근 불가');
      setTimeout(() => setPasteMsg(''), 1500);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key >= '0' && e.key <= '9') handleNum(e.key);
    else if (e.key === '.') { if (!display.includes('.')) setDisplay(display + '.'); }
    else if (e.key === '+') handleOp('+');
    else if (e.key === '-') handleOp('-');
    else if (e.key === '*') handleOp('×');
    else if (e.key === '/') { e.preventDefault(); handleOp('÷'); }
    else if (e.key === 'Enter' || e.key === '=') handleEqual();
    else if (e.key === 'Backspace') handleBackspace();
    else if (e.key === 'Escape') onClose();
    else if (e.key === 'c' || e.key === 'C') handleClear();
  }, [display, prev, op, resetNext]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const btnStyle = (bg?: string, color?: string): React.CSSProperties => ({
    padding: '14px 0', fontSize: 18, fontWeight: 600, border: 'none', borderRadius: 10, cursor: 'pointer',
    background: bg || 'var(--bg-tertiary)', color: color || 'var(--text-primary)',
    transition: 'opacity 0.1s',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)' }} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: 320, margin: '0 16px',
        background: 'var(--bg-primary)', borderRadius: 16,
        border: '1px solid var(--border-primary)', boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}>
        {/* 헤더 */}
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calculator style={{ width: 18, height: 18, color: 'var(--accent-blue)' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>계산기</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* 디스플레이 — 클릭하면 붙여넣기 */}
        <div
          onClick={handlePaste}
          style={{ padding: '20px 20px 12px', textAlign: 'right', cursor: 'pointer', position: 'relative' }}
          title="클릭하면 클립보드에서 붙여넣기"
        >
          {op && <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 4 }}>{fmt(prev || 0)} {op}</div>}
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {(() => { const n = parseFloat(display); return isNaN(n) ? display : fmt(n); })()}
          </div>
          {pasteMsg && (
            <div style={{
              position: 'absolute', bottom: 2, right: 20,
              fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600,
            }}>
              {pasteMsg}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginTop: 4 }}>
            클릭하면 붙여넣기
          </div>
        </div>

        {/* 버튼 그리드 */}
        <div style={{ padding: '8px 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <button onClick={handleClear} style={btnStyle('var(--bg-secondary)', 'var(--color-loss)')}>C</button>
          <button onClick={handleBackspace} style={btnStyle('var(--bg-secondary)')}>
            <Delete style={{ width: 18, height: 18 }} />
          </button>
          <button onClick={() => handleOp('÷')} style={btnStyle('var(--bg-secondary)', 'var(--accent-blue)')}>÷</button>
          <button onClick={() => handleOp('×')} style={btnStyle('var(--bg-secondary)', 'var(--accent-blue)')}>×</button>

          {['7','8','9'].map(n => <button key={n} onClick={() => handleNum(n)} style={btnStyle()}>{n}</button>)}
          <button onClick={() => handleOp('-')} style={btnStyle('var(--bg-secondary)', 'var(--accent-blue)')}>−</button>

          {['4','5','6'].map(n => <button key={n} onClick={() => handleNum(n)} style={btnStyle()}>{n}</button>)}
          <button onClick={() => handleOp('+')} style={btnStyle('var(--bg-secondary)', 'var(--accent-blue)')}>+</button>

          {['1','2','3'].map(n => <button key={n} onClick={() => handleNum(n)} style={btnStyle()}>{n}</button>)}
          <button onClick={handleEqual} style={{ ...btnStyle('var(--accent-blue)', '#fff'), gridRow: 'span 2' }}>=</button>

          <button onClick={() => handleNum('0')} style={{ ...btnStyle(), gridColumn: 'span 2' }}>0</button>
          <button onClick={() => { if (!display.includes('.')) setDisplay(display + '.'); }} style={btnStyle()}>.</button>
        </div>

        {/* 현금에 적용 */}
        <div style={{ padding: '0 16px 16px' }}>
          <button
            onClick={() => onApply(Math.round(parseFloat(display) || 0))}
            style={{
              width: '100%', padding: '12px 0', fontSize: 15, fontWeight: 700,
              background: 'var(--accent-blue)', color: '#fff', border: 'none',
              borderRadius: 10, cursor: 'pointer',
            }}
          >
            현금에 적용
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 계좌 카드 ── */
function AccountCard({
  account, onUpdate, onDelete, isAmountHidden, prices,
}: {
  account: Account; onUpdate: (a: Account) => void; onDelete: () => void; isAmountHidden: boolean; prices: Record<string, number>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editAlias, setEditAlias] = useState(account.alias);
  const [editInst, setEditInst] = useState(account.institution);
  const [editType, setEditType] = useState(account.accountType);
  const [addingHolding, setAddingHolding] = useState(false);
  const [editingHoldingId, setEditingHoldingId] = useState<string | null>(null);

  const isFunsu = account.alias === '펀슈';
  const [addingFund, setAddingFund] = useState(false);
  const [editingCash, setEditingCash] = useState(false);
  const [cashInput, setCashInput] = useState((account.cash || 0).toString());
  const [showCalc, setShowCalc] = useState(false);

  const cash = account.cash || 0;
  const totalPurchase = account.holdings.reduce((s, h) => s + holdingCost(h), 0);
  const totalCurrent = account.holdings.reduce((s, h) => {
    return s + holdingValue(h, prices[h.ticker]);
  }, 0);
  const totalWithCash = totalCurrent + cash;
  const totalPnl = totalCurrent - totalPurchase;
  const totalPnlRate = totalPurchase > 0 ? (totalPnl / totalPurchase) * 100 : 0;

  const saveCash = () => {
    const val = parseFloat(cashInput) || 0;
    onUpdate({ ...account, cash: val });
    setEditingCash(false);
  };

  const saveEdit = () => {
    onUpdate({ ...account, alias: editAlias, institution: editInst, accountType: editType });
    setEditing(false);
  };

  const addHolding = (h: Omit<Holding, 'id'>) => {
    onUpdate({ ...account, holdings: [...account.holdings, { ...h, id: generateId() }] });
    setAddingHolding(false);
  };

  const addFund = (name: string, amount: number) => {
    const fund: Holding = { id: generateId(), name, ticker: '', market: 'KR', avgPrice: 0, quantity: 0, isFund: true, amount };
    onUpdate({ ...account, holdings: [...account.holdings, fund] });
    setAddingFund(false);
  };

  const updateFund = (id: string, name: string, amount: number) => {
    onUpdate({ ...account, holdings: account.holdings.map(x => x.id === id ? { ...x, name, amount } : x) });
    setEditingHoldingId(null);
  };

  const updateHolding = (id: string, h: Omit<Holding, 'id'>) => {
    onUpdate({ ...account, holdings: account.holdings.map(x => x.id === id ? { ...h, id } : x) });
    setEditingHoldingId(null);
  };

  const deleteHolding = (id: string) => {
    onUpdate({ ...account, holdings: account.holdings.filter(x => x.id !== id) });
  };

  return (
    <div className="toss-card">
      {/* 헤더 */}
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer transition-colors"
        style={{ borderBottom: expanded ? '1px solid var(--border-primary)' : 'none', padding: 20 }}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' }}>
            <AccountTypeIcon type={account.accountType} />
          </div>
          <div>
            {editing ? (
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <input className="toss-input" style={{ width: 120, padding: '6px 10px' }} value={editAlias} onChange={e => setEditAlias(e.target.value)} />
                <select className="toss-select" value={editInst} onChange={e => setEditInst(e.target.value)}>
                  {INSTITUTIONS.map(i => <option key={i}>{i}</option>)}
                </select>
                <select className="toss-select" value={editType} onChange={e => setEditType(e.target.value)}>
                  {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <button onClick={e => { e.stopPropagation(); saveEdit(); }} className="toss-btn toss-btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}>
                  <Save className="w-3 h-3" />
                </button>
                <button onClick={e => { e.stopPropagation(); setEditing(false); }} className="toss-btn toss-btn-ghost" style={{ padding: '6px 8px' }}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>{account.alias}</span>
                  <span className="toss-badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{account.accountType}</span>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {account.institution} · {account.holdings.length}개 종목
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right mr-1">
            <p className="toss-number" style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
              {isAmountHidden ? '••••' : `${fmt(totalWithCash)}원`}
            </p>
            <p className="toss-number" style={{
              fontSize: 'var(--text-xs)', marginTop: 2,
              color: totalPnl > 0 ? 'var(--color-profit)' : totalPnl < 0 ? 'var(--color-loss)' : 'var(--text-tertiary)',
            }}>
              {isAmountHidden ? '••••' : `${totalPnl > 0 ? '+' : ''}${fmt(totalPnl)}원 (${totalPnlRate > 0 ? '+' : ''}${totalPnlRate.toFixed(2)}%)`}
            </p>
          </div>
          {!editing && (
            <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
              <button onClick={() => setEditing(true)} className="p-1.5 rounded-md transition-colors" style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}>
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button onClick={onDelete} className="p-1.5 rounded-md transition-colors" style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-profit-bg)'; e.currentTarget.style.color = 'var(--color-profit)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <ChevronDown className="w-4 h-4 transition-transform" style={{ color: 'var(--text-tertiary)', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }} />
        </div>
      </div>

      {/* 종목 목록 */}
      {expanded && (
        <div>
          {/* 현금 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px', borderBottom: '1px solid var(--border-primary)',
            background: 'var(--bg-secondary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Banknote style={{ width: 16, height: 16, color: 'var(--text-tertiary)' }} />
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--text-primary)' }}>현금</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {editingCash ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                  <input
                    className="toss-input"
                    type="number"
                    value={cashInput}
                    onChange={e => setCashInput(e.target.value)}
                    style={{ width: 140, padding: '6px 10px', textAlign: 'right' }}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') saveCash(); if (e.key === 'Escape') setEditingCash(false); }}
                  />
                  <button onClick={saveCash} className="toss-btn toss-btn-primary" style={{ padding: '6px 10px', fontSize: 12 }}>
                    <Save style={{ width: 12, height: 12 }} />
                  </button>
                  <button onClick={() => setEditingCash(false)} className="toss-btn toss-btn-ghost" style={{ padding: '6px 8px' }}>
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              ) : (
                <>
                  <span className="toss-number" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
                    {isAmountHidden ? '••••' : `${fmt(cash)}원`}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); setCashInput(cash.toString()); setEditingCash(true); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}
                  >
                    <Edit3 style={{ width: 12, height: 12 }} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setShowCalc(true); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}
                    title="계산기"
                  >
                    <Calculator style={{ width: 14, height: 14 }} />
                  </button>
                </>
              )}
            </div>
          </div>

          {account.holdings.length > 0 && (
            <table className="toss-table">
              <thead>
                <tr>
                  <th>종목명</th>
                  <th>티커</th>
                  <th style={{ textAlign: 'right' }}>평단가</th>
                  <th style={{ textAlign: 'right' }}>현재가</th>
                  <th style={{ textAlign: 'right' }}>수량</th>
                  <th style={{ textAlign: 'right' }}>매입금액</th>
                  <th style={{ textAlign: 'right' }}>평가금액</th>
                  <th style={{ textAlign: 'right' }}>수익률</th>
                  <th style={{ textAlign: 'center', width: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {account.holdings.map(h => {
                  if (editingHoldingId === h.id) {
                    return h.isFund ? (
                      <tr key={h.id}>
                        <td colSpan={9} style={{ padding: 8 }}>
                          <FundForm fund={h} onSave={(name, amount) => updateFund(h.id, name, amount)} onCancel={() => setEditingHoldingId(null)} />
                        </td>
                      </tr>
                    ) : (
                      <tr key={h.id}>
                        <td colSpan={9} style={{ padding: 8 }}>
                          <HoldingForm holding={h} onSave={d => updateHolding(h.id, d)} onCancel={() => setEditingHoldingId(null)} />
                        </td>
                      </tr>
                    );
                  }

                  if (h.isFund) {
                    return (
                      <tr key={h.id}>
                        <td style={{ fontWeight: 'var(--font-medium)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {h.name}
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>펀드</span>
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>-</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>-</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>-</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>-</td>
                        <td className="toss-number" style={{ textAlign: 'right' }}>
                          {isAmountHidden ? '••••' : `${fmt(h.amount || 0)}원`}
                        </td>
                        <td className="toss-number" style={{ textAlign: 'right', fontWeight: 'var(--font-semibold)' }}>
                          {isAmountHidden ? '••••' : `${fmt(h.amount || 0)}원`}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>-</td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="flex items-center justify-center gap-0.5">
                            <button onClick={() => setEditingHoldingId(h.id)} className="p-1 rounded transition-colors" style={{ color: 'var(--text-tertiary)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button onClick={() => deleteHolding(h.id)} className="p-1 rounded transition-colors" style={{ color: 'var(--text-tertiary)' }}
                              onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-profit)'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}>
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 'var(--font-medium)' }}>{h.name}</td>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 'var(--font-medium)' }}>
                        {h.ticker ? (
                          <a href={`https://www.tossinvest.com/stocks/A${h.ticker}/order`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>{h.ticker}</a>
                        ) : '-'}
                      </td>
                      <td className="toss-number" style={{ textAlign: 'right' }}>
                        {isAmountHidden ? '••••' : fmt(h.avgPrice)}
                      </td>
                      <td className="toss-number" style={{ textAlign: 'right' }}>
                        {(() => {
                          const cp = prices[h.ticker];
                          if (isAmountHidden) return '••••';
                          if (!cp) return <span style={{ color: 'var(--text-tertiary)' }}>-</span>;
                          return fmt(cp);
                        })()}
                      </td>
                      <td className="toss-number" style={{ textAlign: 'right' }}>
                        {isAmountHidden ? '••••' : fmt(h.quantity)}
                      </td>
                      <td className="toss-number" style={{ textAlign: 'right' }}>
                        {isAmountHidden ? '••••' : `${fmt(h.avgPrice * h.quantity)}원`}
                      </td>
                      {(() => {
                        const cp = prices[h.ticker];
                        const evalAmt = cp ? cp * h.quantity : h.avgPrice * h.quantity;
                        const pnl = cp ? evalAmt - h.avgPrice * h.quantity : 0;
                        const pnlRate = cp && h.avgPrice > 0 ? ((cp - h.avgPrice) / h.avgPrice) * 100 : 0;
                        return (
                          <>
                            <td className="toss-number" style={{ textAlign: 'right', fontWeight: 'var(--font-semibold)' }}>
                              {isAmountHidden ? '••••' : `${fmt(evalAmt)}원`}
                            </td>
                            <td className="toss-number" style={{
                              textAlign: 'right', fontWeight: 'var(--font-semibold)', fontSize: 'var(--text-xs)',
                              color: pnl > 0 ? 'var(--color-profit)' : pnl < 0 ? 'var(--color-loss)' : 'var(--text-tertiary)',
                            }}>
                              {isAmountHidden ? '••••' : !cp ? '-' : (
                                <span>
                                  {pnl > 0 ? '+' : ''}{fmt(pnl)}원<br/>
                                  <span style={{ fontSize: 11 }}>({pnlRate > 0 ? '+' : ''}{pnlRate.toFixed(2)}%)</span>
                                </span>
                              )}
                            </td>
                          </>
                        );
                      })()}
                      <td style={{ textAlign: 'center' }}>
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => setEditingHoldingId(h.id)} className="p-1 rounded transition-colors" style={{ color: 'var(--text-tertiary)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button onClick={() => deleteHolding(h.id)} className="p-1 rounded transition-colors" style={{ color: 'var(--text-tertiary)' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-profit)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}>
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {addingHolding ? (
              <HoldingForm onSave={addHolding} onCancel={() => setAddingHolding(false)} />
            ) : addingFund ? (
              <FundForm onSave={addFund} onCancel={() => setAddingFund(false)} />
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setAddingHolding(true)}
                  className="py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  style={{ flex: 1, border: '2px dashed var(--border-primary)', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.color = 'var(--accent-blue)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                >
                  <Plus className="w-3.5 h-3.5" /> 종목 추가
                </button>
                {isFunsu && (
                  <button
                    onClick={() => setAddingFund(true)}
                    className="py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    style={{ flex: 1, border: '2px dashed var(--border-primary)', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.color = '#7C3AED'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                  >
                    <Plus className="w-3.5 h-3.5" /> 펀드 추가
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 계산기 모달 */}
      {showCalc && (
        <CalculatorModal
          onClose={() => setShowCalc(false)}
          onApply={(val) => {
            onUpdate({ ...account, cash: val });
            setShowCalc(false);
          }}
          initialValue={cash}
        />
      )}
    </div>
  );
}

/* ── 계좌 추가 폼 ── */
function AddAccountForm({
  owner, ownerName, onSave, onCancel,
}: {
  owner: 'wife' | 'husband'; ownerName: string; onSave: (a: Account) => void; onCancel: () => void;
}) {
  const [alias, setAlias] = useState('');
  const [inst, setInst] = useState(INSTITUTIONS[0]);
  const [type, setType] = useState(ACCOUNT_TYPES[0]);

  return (
    <div className="toss-card" style={{ padding: 20, border: '2px solid var(--accent-blue)', background: 'var(--accent-blue-bg)' }}>
      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', marginBottom: 12 }}>새 계좌 추가</p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="계좌 별칭 *" w="flex-1 min-w-[140px]">
          <input className="toss-input" value={alias} onChange={e => setAlias(e.target.value)} placeholder="예: 미래에셋 연금" />
        </Field>
        <Field label="증권사/은행" w="w-[160px]">
          <select className="toss-select w-full" value={inst} onChange={e => setInst(e.target.value)}>
            {INSTITUTIONS.map(i => <option key={i}>{i}</option>)}
          </select>
        </Field>
        <Field label="계좌유형" w="w-[120px]">
          <select className="toss-select w-full" value={type} onChange={e => setType(e.target.value)}>
            {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <div className="flex gap-1.5">
          <button onClick={() => {
            if (!alias.trim()) return;
            onSave({ id: generateId(), owner, ownerName, institution: inst, accountType: type, alias: alias.trim(), holdings: [] });
          }} className="toss-btn toss-btn-primary" style={{ padding: '10px 18px', fontSize: 13 }}>
            <Save className="w-3.5 h-3.5" /> 저장
          </button>
          <button onClick={onCancel} className="toss-btn toss-btn-secondary" style={{ padding: '10px 14px', fontSize: 13 }}>취소</button>
        </div>
      </div>
    </div>
  );
}

/* ── 소유자 섹션 ── */
function OwnerSection({
  owner, ownerName, accounts, onUpdateAccount, onDeleteAccount, onAddAccount, isAmountHidden, prices,
}: {
  owner: 'wife' | 'husband'; ownerName: string; accounts: Account[];
  onUpdateAccount: (a: Account) => void; onDeleteAccount: (id: string) => void; onAddAccount: (a: Account) => void;
  isAmountHidden: boolean; prices: Record<string, number>;
}) {
  const [adding, setAdding] = useState(false);
  const total = accounts.reduce((s, a) => s + (a.cash || 0) + a.holdings.reduce((ss, h) => {
    return ss + holdingValue(h, prices[h.ticker]);
  }, 0), 0);
  const holdingsCount = accounts.reduce((s, a) => s + a.holdings.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between" style={{ padding: '0 4px' }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {accounts.length}개 계좌 · {holdingsCount}개 종목
        </span>
        <span className="toss-number" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 'var(--font-semibold)' }}>
          총 {isAmountHidden ? '••••' : `${fmt(total)}원`}
        </span>
      </div>

      {accounts.map(acc => (
        <AccountCard key={acc.id} account={acc} onUpdate={onUpdateAccount} onDelete={() => onDeleteAccount(acc.id)} isAmountHidden={isAmountHidden} prices={prices} />
      ))}

      {adding ? (
        <AddAccountForm owner={owner} ownerName={ownerName} onSave={a => { onAddAccount(a); setAdding(false); }} onCancel={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          style={{ border: '2px dashed var(--border-primary)', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 500 }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.color = 'var(--accent-blue)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
        >
          <Plus className="w-4 h-4" /> 새 계좌 추가
        </button>
      )}
    </div>
  );
}

/* ── 메인 페이지 ── */
export function CoupleAccounts() {
  const { accounts, setAccounts, isAmountHidden, otherAssets, setOtherAssets, prices, loadPrices: contextLoadPrices } = useAppContext();
  const [activeTab, setActiveTab] = useState<'wife' | 'husband' | 'other'>('wife');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [priceLoading, setPriceLoading] = useState(false);

  const wifeAccounts = accounts.filter(a => a.owner === 'wife');
  const husbandAccounts = accounts.filter(a => a.owner === 'husband');

  // 현재가 조회
  const loadPrices = async () => {
    setPriceLoading(true);
    try { await contextLoadPrices(); }
    catch (err) { console.error('현재가 조회 실패:', err); }
    finally { setPriceLoading(false); }
  };

  const autoSave = async (next: Account[]) => {
    setAccounts(next);
    setSaveStatus('saving');
    try { await saveAccounts(next); setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); }
    catch { setSaveStatus('error'); }
  };

  const update = (a: Account) => autoSave(accounts.map(x => x.id === a.id ? a : x));
  const del = (id: string) => { if (confirm('이 계좌를 삭제하시겠습니까?')) autoSave(accounts.filter(x => x.id !== id)); };
  const add = (a: Account) => autoSave([...accounts, a]);

  const calcHoldings = (accs: Account[]) => accs.reduce((s, a) => s + (a.cash || 0) + a.holdings.reduce((ss, h) => {
    return ss + holdingValue(h, prices[h.ticker]);
  }, 0), 0);
  const wifeTotal = calcHoldings(wifeAccounts);
  const husbandTotal = calcHoldings(husbandAccounts);
  const otherTotal = otherAssets.reduce((s, a) => s + a.amount, 0);
  const totalAll = wifeTotal + husbandTotal + otherTotal;

  return (
    <div style={{ padding: '24px' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>부부 계좌</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 4 }}>계좌와 보유종목을 관리합니다</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saveStatus !== 'idle' && (
            <span style={{ fontSize: 'var(--text-xs)', color: saveStatus === 'error' ? 'var(--color-error)' : saveStatus === 'saved' ? 'var(--color-success)' : 'var(--text-tertiary)' }}
              className="flex items-center gap-1">
              {saveStatus === 'saving' && <><RefreshCw className="w-3 h-3 animate-spin" /> 저장 중...</>}
              {saveStatus === 'saved' && '저장 완료'}
              {saveStatus === 'error' && '저장 실패'}
            </span>
          )}
          <button
            onClick={loadPrices}
            disabled={priceLoading}
            className="toss-btn toss-btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', padding: '6px 12px' }}
          >
            <RefreshCw style={{ width: 14, height: 14, ...(priceLoading ? { animation: 'spin 1s linear infinite' } : {}) }} />
            {priceLoading ? '조회 중...' : '현재가 새로고침'}
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <SummaryCard label="부부 합산" value={totalAll} sub={`${accounts.length}개 계좌 + 기타 ${otherAssets.length}건`} isAmountHidden={isAmountHidden} accent />
        <SummaryCard label="👩 지윤" value={wifeTotal + otherAssets.filter(a => a.owner === 'wife').reduce((s, a) => s + a.amount, 0)} sub={`${wifeAccounts.length}개 계좌`} isAmountHidden={isAmountHidden} />
        <SummaryCard label="👨 오빠" value={husbandTotal + otherAssets.filter(a => a.owner === 'husband').reduce((s, a) => s + a.amount, 0)} sub={`${husbandAccounts.length}개 계좌`} isAmountHidden={isAmountHidden} />
        <SummaryCard label="📦 기타" value={otherTotal} sub={`${otherAssets.length}건`} isAmountHidden={isAmountHidden} />
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, padding: '4px 0' }}>
        {[
          { key: 'wife' as const, label: '지윤' },
          { key: 'husband' as const, label: '오빠' },
          { key: 'other' as const, label: '기타' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`toss-tab ${activeTab === tab.key ? 'toss-tab-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 계좌 목록 */}
      {activeTab === 'wife' && (
        <OwnerSection owner="wife" ownerName="지윤" accounts={wifeAccounts}
          onUpdateAccount={update} onDeleteAccount={del} onAddAccount={add} isAmountHidden={isAmountHidden} prices={prices} />
      )}
      {activeTab === 'husband' && (
        <OwnerSection owner="husband" ownerName="오빠" accounts={husbandAccounts}
          onUpdateAccount={update} onDeleteAccount={del} onAddAccount={add} isAmountHidden={isAmountHidden} prices={prices} />
      )}
      {activeTab === 'other' && (
        <OtherAssetsSection assets={otherAssets} onUpdate={setOtherAssets} isAmountHidden={isAmountHidden} />
      )}
    </div>
  );
}

/* ── 기타 자산 섹션 ── */
function OtherAssetsSection({
  assets, onUpdate, isAmountHidden,
}: {
  assets: OtherAsset[]; onUpdate: (a: OtherAsset[]) => void; isAmountHidden: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const wifeAssets = assets.filter(a => a.owner === 'wife');
  const husbandAssets = assets.filter(a => a.owner === 'husband');
  const wifeTotal = wifeAssets.reduce((s, a) => s + a.amount, 0);
  const husbandTotal = husbandAssets.reduce((s, a) => s + a.amount, 0);
  const total = wifeTotal + husbandTotal;

  const handleSave = (item: OtherAsset) => {
    const exists = assets.find(a => a.id === item.id);
    if (exists) {
      onUpdate(assets.map(a => a.id === item.id ? item : a));
    } else {
      onUpdate([...assets, item]);
    }
    setEditingId(null);
    setAdding(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('이 자산을 삭제하시겠습니까?')) onUpdate(assets.filter(a => a.id !== id));
  };

  const renderGroup = (label: string, emoji: string, items: OtherAsset[], groupTotal: number, owner: 'wife' | 'husband') => (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px' }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
          {emoji} {label}
        </span>
        <span className="toss-number" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 'var(--font-semibold)' }}>
          {isAmountHidden ? '••••' : `${fmt(groupTotal)}원`}
        </span>
      </div>
      <div className="toss-card">
        {items.map((item, i) => (
          editingId === item.id ? (
            <OtherAssetForm key={item.id} asset={item} owner={owner} onSave={handleSave} onCancel={() => setEditingId(null)} />
          ) : (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px',
              borderBottom: i < items.length - 1 ? '1px solid var(--border-secondary)' : 'none',
            }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--text-primary)' }}>{item.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="toss-number" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
                  {isAmountHidden ? '••••' : `${fmt(item.amount)}원`}
                </span>
                <span className="toss-number" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', minWidth: 40, textAlign: 'right' }}>
                  {total > 0 ? ((item.amount / total) * 100).toFixed(1) : 0}%
                </span>
                <button onClick={() => setEditingId(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}>
                  <Edit3 style={{ width: 14, height: 14 }} />
                </button>
                <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}>
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
          )
        ))}
        {items.length === 0 && (
          <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
            등록된 자산이 없습니다
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 4px' }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          총 {assets.length}건
        </span>
        <span className="toss-number" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 'var(--font-semibold)' }}>
          총 {isAmountHidden ? '••••' : `${fmt(total)}원`}
        </span>
      </div>

      {renderGroup('지윤', '👩', wifeAssets, wifeTotal, 'wife')}
      {renderGroup('오빠', '👨', husbandAssets, husbandTotal, 'husband')}

      {adding ? (
        <OtherAssetForm owner="wife" onSave={handleSave} onCancel={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 12, border: '2px dashed var(--border-primary)',
            background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontWeight: 500, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.color = 'var(--accent-blue)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
        >
          <Plus style={{ width: 16, height: 16 }} /> 기타 자산 추가
        </button>
      )}
    </div>
  );
}

function OtherAssetForm({
  asset, owner, onSave, onCancel,
}: {
  asset?: OtherAsset; owner: 'wife' | 'husband'; onSave: (a: OtherAsset) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(asset?.name || '');
  const [amount, setAmount] = useState(asset?.amount?.toString() || '');
  const [selectedOwner, setSelectedOwner] = useState<'wife' | 'husband'>(asset?.owner === 'husband' ? 'husband' : owner);

  const submit = () => {
    if (!name.trim() || !amount) return;
    onSave({
      id: asset?.id || generateId(),
      owner: selectedOwner,
      name: name.trim(),
      amount: parseFloat(amount),
    });
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 8, padding: 12, borderRadius: 12, background: 'var(--bg-secondary)' }}>
      <Field label="소유자" w="w-[100px]">
        <select className="toss-select w-full" value={selectedOwner} onChange={e => setSelectedOwner(e.target.value as 'wife' | 'husband')}>
          <option value="wife">지윤</option>
          <option value="husband">오빠</option>
        </select>
      </Field>
      <Field label="자산명 *" w="flex-1 min-w-[150px]">
        <input className="toss-input" value={name} onChange={e => setName(e.target.value)} placeholder="예: 비트코인" />
      </Field>
      <Field label="금액 *" w="w-[180px]">
        <input className="toss-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
      </Field>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={submit} className="toss-btn toss-btn-primary" style={{ padding: '8px 14px', fontSize: 13 }}>
          <Save style={{ width: 14, height: 14 }} />{asset ? '수정' : '추가'}
        </button>
        <button onClick={onCancel} className="toss-btn toss-btn-ghost" style={{ padding: '8px 10px' }}>
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, isAmountHidden, accent }: {
  label: string; value: number; sub: string; isAmountHidden: boolean; accent?: boolean;
}) {
  return (
    <div className="toss-card" style={{
      padding: '20px',
      ...(accent ? { background: 'var(--accent-blue)', border: 'none' } : {}),
    }}>
      <p style={{ fontSize: 'var(--text-xs)', color: accent ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)', fontWeight: 500, marginBottom: 6 }}>{label}</p>
      <p className="toss-number" style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: accent ? '#fff' : 'var(--text-primary)' }}>
        {isAmountHidden ? '••••' : `${fmt(value)}원`}
      </p>
      <p style={{ fontSize: 'var(--text-xs)', color: accent ? 'rgba(255,255,255,0.5)' : 'var(--text-tertiary)', marginTop: 4 }}>{sub}</p>
    </div>
  );
}
