import React, { useState, useRef, useEffect } from 'react';
import { MIcon } from './MIcon';
import { loadArchive, saveToArchive } from '../data/chatArchive';
import type { ArchivedQA } from '../data/chatArchive';


interface Message {
  role: 'user' | 'assistant' | 'archive';
  content: string;
  archiveMatches?: ArchivedQA[];
}

function searchArchive(archive: ArchivedQA[], query: string): ArchivedQA[] {
  if (!query.trim()) return [];

  const words = query.trim().toLowerCase().split(/\s+/).filter(k => k.length >= 2);
  if (words.length === 0) return [];

  // 공백 없이 붙여 쓴 한국어 복합어("추세붕괴" → "추세","세붕","붕괴")도
  // 2글자 슬라이딩 윈도우로 분해해 매칭
  const keywords = new Set<string>();
  for (const word of words) {
    keywords.add(word);
    if (word.length > 2) {
      for (let i = 0; i <= word.length - 2; i++) {
        keywords.add(word.slice(i, i + 2));
      }
    }
  }

  return archive.filter(qa => {
    const haystack = (qa.question + ' ' + qa.topic + ' ' + qa.answerHtml.replace(/<[^>]+>/g, '')).toLowerCase();
    return [...keywords].some(k => haystack.includes(k));
  });
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isInline?: boolean;
}

const QUICK_CHIPS = [
  { label: '대시보드', icon: 'dashboard' },
  { label: '계좌종목등록', icon: 'group' },
  { label: '최적 가이드', icon: 'stars' },
  { label: '배당', icon: 'paid' },
  { label: '국민성장펀드', icon: 'account_balance' },
  { label: '리밸런싱', icon: 'tune' },
  { label: '차트', icon: 'candlestick_chart' },
  { label: '보유종목', icon: 'list' },
  { label: '자산증감', icon: 'show_chart' },
  { label: '납입', icon: 'savings' },
  { label: '계좌수익률', icon: 'percent' },
  { label: '재정평가', icon: 'summarize' },
  { label: '가계부', icon: 'receipt_long' },
  { label: '2026년5월', icon: 'calendar_month' },
];

// 칩별 아카이브 검색 키워드 (label 단어 외 추가 연관어)
const CHIP_SEARCH_KEYS: Record<string, string> = {
  '차트':      '차트 MA20 이동평균 골든크로스 추세 이탈',
  '최적 가이드': '최적 가이드 MA20 추세 보유 매도 손절 타이밍',
  '리밸런싱':   'ETF 모멘텀 크래시 매도 분산 반도체 리밸런싱',
  '보유종목':   '보유 종목 ETF 반도체',
  '대시보드':   '대시보드 증감 날짜 복원 스냅샷',
};

function getTodayLabel() {
  const d = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}(${days[d.getDay()]})`;
}

function groupByDate(items: ArchivedQA[]) {
  const map = new Map<string, ArchivedQA[]>();
  items.forEach(item => {
    const list = map.get(item.date) ?? [];
    list.push(item);
    map.set(item.date, list);
  });
  return map;
}

export function ChatPanel({ isOpen, onClose, isInline = false }: ChatPanelProps) {
  const [tab, setTab] = useState<'chat' | 'archive'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [chipsUsed, setChipsUsed] = useState(false);
  const [archive, setArchive] = useState<ArchivedQA[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedToast, setSavedToast] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setArchive(loadArchive());
      if (inputRef.current && tab === 'chat') inputRef.current.focus();
    }
  }, [isOpen, tab]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function selectChip(label: string) {
    setChipsUsed(true);
    const searchKey = CHIP_SEARCH_KEYS[label] ?? label;
    const matches = searchArchive(archive, searchKey);
    const msgs: Message[] = [{ role: 'user', content: label }];
    if (matches.length > 0) {
      msgs.push({ role: 'assistant', content: `${label} 관련 저장된 내용 ${matches.length}건이에요. 항목을 선택해서 펼쳐보세요.` });
      msgs.push({ role: 'archive', content: '', archiveMatches: matches });
    } else {
      msgs.push({ role: 'assistant', content: `${label}에서 무엇이 궁금하세요?` });
    }
    setMessages(msgs);
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setChipsUsed(true);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const userMsg: Message = { role: 'user', content: trimmed };
    const withUser: Message[] = [...messages, userMsg];

    // 아카이브 검색
    const matches = searchArchive(archive, trimmed);
    const next: Message[] = matches.length > 0
      ? [...withUser, { role: 'archive', content: '', archiveMatches: matches }]
      : withUser;
    setMessages(next);
  }

  function saveCurrentChat() {
    const userMsg = messages.find(m => m.role === 'user');
    const aiMsg = messages.find(m => m.role === 'assistant');
    if (!userMsg || !aiMsg) return;

    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    const lastAi = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastUser || !lastAi) return;

    const qa: ArchivedQA = {
      id: `qa_${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      topic: lastUser.content.slice(0, 20),
      question: lastUser.content,
      answerHtml: `<p>${lastAi.content.replace(/\n/g, '<br>')}</p>`,
    };
    saveToArchive(qa);
    setArchive(loadArchive());
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  }

  function resetChat() {
    setMessages([]);
    setChipsUsed(false);
    setInput('');
  }

  const filteredArchive = searchQuery.trim()
    ? archive.filter(q =>
        q.question.includes(searchQuery) ||
        q.topic.includes(searchQuery) ||
        q.answerHtml.replace(/<[^>]+>/g, '').includes(searchQuery)
      )
    : archive;

  const grouped = groupByDate(filteredArchive);

  return (
    <>
      {/* 모바일 backdrop */}
      {!isInline && isOpen && (
        <div onClick={onClose} style={{
          position: 'fixed', inset: 0, zIndex: 299,
          background: 'rgba(0,0,0,0.25)',
          animation: 'cpFadeIn 0.2s ease',
        }} />
      )}

      <div style={isInline ? {
        /* PC 인라인 모드: 부모 flex 컨테이너가 너비 제어 */
        width: '100%', height: '100%',
        background: 'var(--bg-secondary)',
        display: 'flex', flexDirection: 'column',
      } : {
        /* 모바일 overlay 모드 */
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 380, zIndex: 300,
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-primary)',
        display: 'flex', flexDirection: 'column',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: isOpen ? '-8px 0 32px rgba(0,0,0,0.18)' : 'none',
      }}>

        {/* ── 헤더 ── */}
        <div style={{
          height: 56, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 12px 0 16px',
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-primary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <MIcon name="smart_toy" size={18} style={{ color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>AI 어시스턴트</div>
              <div style={{ fontSize: 11, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} />
                온라인
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {tab === 'chat' && messages.length > 1 && (
              <button onClick={saveCurrentChat} style={iconBtnStyle} title="대화 저장"
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <MIcon name="bookmark" size={18} />
              </button>
            )}
            {tab === 'chat' && messages.length > 0 && (
              <button onClick={resetChat} style={iconBtnStyle} title="대화 초기화"
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <MIcon name="refresh" size={18} />
              </button>
            )}
            <button onClick={onClose} style={iconBtnStyle} title="닫기"
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <MIcon name="close" size={18} />
            </button>
          </div>
        </div>

        {/* ── 탭 ── */}
        <div style={{
          display: 'flex', flexShrink: 0,
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-primary)',
          padding: '0 16px',
        }}>
          {(['chat', 'archive'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 14px', fontSize: 13, fontWeight: 600,
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: tab === t ? 'var(--accent-blue)' : 'var(--text-tertiary)',
              borderBottom: tab === t ? '2px solid var(--accent-blue)' : '2px solid transparent',
              transition: 'all 0.15s', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <MIcon name={t === 'chat' ? 'chat' : 'bookmarks'} size={15} />
              {t === 'chat' ? '대화' : `아카이브 ${archive.length > 0 ? `(${archive.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* ── 대화 탭 ── */}
        {tab === 'chat' && (
          <>
            <div className="custom-scrollbar" style={{
              flex: 1, overflowY: 'auto',
              padding: '20px 14px 8px',
              display: 'flex', flexDirection: 'column',
            }}>
              {/* 날짜 pill */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <span style={{
                  fontSize: 11, color: 'var(--text-tertiary)',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 20, padding: '3px 12px', fontWeight: 500,
                }}>{getTodayLabel()}</span>
              </div>

              {/* 웰컴 */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-start' }}>
                <AiAvatar />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>AI 어시스턴트</div>
                  <div style={aiBubbleStyle}>
                    <span style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                      안녕하세요!<br />자산관리 AI 어시스턴트입니다.<br />무엇을 도와드릴까요?
                    </span>
                  </div>
                </div>
              </div>

              {/* 빠른 선택 칩 */}
              {!chipsUsed && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'flex-start' }}>
                  <AiAvatar />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>AI 어시스턴트</div>
                    <div style={aiBubbleStyle}>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                        문의할 내용을 선택해 주세요
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {QUICK_CHIPS.map(chip => (
                          <button key={chip.label} onClick={() => selectChip(chip.label)} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '5px 11px', borderRadius: 20,
                            border: '1px solid var(--border-primary)',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            fontSize: 12, fontWeight: 500, cursor: 'pointer',
                            transition: 'all 0.15s', fontFamily: 'inherit',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--accent-blue)';
                            e.currentTarget.style.color = '#fff';
                            e.currentTarget.style.borderColor = 'var(--accent-blue)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'var(--bg-primary)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                            e.currentTarget.style.borderColor = 'var(--border-primary)';
                          }}>
                            <MIcon name={chip.icon} size={13} />
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 대화 메시지 */}
              {messages.map((m, i) => {
                if (m.role === 'archive' && m.archiveMatches) {
                  return (
                    <ArchiveMatchBlock key={i} matches={m.archiveMatches} />
                  );
                }
                return (
                  <div key={i} style={{
                    display: 'flex',
                    flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                    gap: 8, marginBottom: 16, alignItems: 'flex-start',
                  }}>
                    {m.role === 'assistant' && <AiAvatar />}
                    <div style={{ maxWidth: '76%' }}>
                      {m.role === 'assistant' && (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>AI 어시스턴트</div>
                      )}
                      <div style={m.role === 'user' ? userBubbleStyle : aiBubbleStyle}>
                        <span style={{
                          fontSize: 13, lineHeight: 1.65,
                          color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>{m.content}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div ref={bottomRef} />
            </div>

            {/* 입력 폼 */}
            <div style={{
              flexShrink: 0, padding: '10px 14px 16px',
              background: 'var(--bg-primary)',
              borderTop: '1px solid var(--border-primary)',
            }}>
              <div style={{
                display: 'flex', gap: 8, alignItems: 'flex-end',
                background: 'var(--bg-secondary)',
                borderRadius: 24, padding: '8px 8px 8px 16px',
                border: '1.5px solid var(--border-primary)',
                transition: 'border-color 0.15s',
              }}
                onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent-blue)'; }}
                onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-primary)'; }}
              >
                <textarea ref={inputRef} value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
                  }}
                  placeholder="질문을 입력해주세요."
                  rows={1}
                  style={{
                    flex: 1, border: 'none', outline: 'none', resize: 'none',
                    background: 'transparent', color: 'var(--text-primary)',
                    fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit',
                    maxHeight: 100, overflowY: 'auto', paddingTop: 2,
                  }}
                  onInput={e => {
                    const t = e.currentTarget;
                    t.style.height = 'auto';
                    t.style.height = Math.min(t.scrollHeight, 100) + 'px';
                  }}
                />
                <button onClick={() => sendMessage(input)} disabled={!input.trim()} style={{
                  width: 36, height: 36, borderRadius: 18, border: 'none', cursor: 'pointer',
                  background: input.trim()
                    ? 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)'
                    : 'var(--bg-tertiary)',
                  color: input.trim() ? '#fff' : 'var(--text-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.15s',
                }}>
                  <MIcon name="send" size={16} />
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginTop: 6, textAlign: 'center' }}>
                Shift+Enter 줄바꿈 &middot; Enter 전송
              </div>
            </div>
          </>
        )}

        {/* ── 아카이브 탭 ── */}
        {tab === 'archive' && (
          <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {/* 검색 */}
            <div style={{ padding: '12px 14px 8px', flexShrink: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--bg-primary)', borderRadius: 10,
                padding: '7px 12px',
                border: '1px solid var(--border-primary)',
              }}>
                <MIcon name="search" size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="저장된 대화 검색..."
                  style={{
                    flex: 1, border: 'none', outline: 'none',
                    background: 'transparent', color: 'var(--text-primary)',
                    fontSize: 13, fontFamily: 'inherit',
                  }}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-tertiary)' }}>
                    <MIcon name="close" size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Q&A 목록 */}
            <div style={{ padding: '0 14px 20px', flex: 1 }}>
              {grouped.size === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: '40px 0' }}>
                  저장된 대화가 없습니다
                </div>
              ) : (
                Array.from(grouped.entries()).map(([date, items]) => (
                  <div key={date}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      margin: '20px 0 12px',
                    }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--border-primary)' }} />
                      <span style={{
                        fontSize: 11, color: 'var(--text-tertiary)',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 20, padding: '2px 10px', fontWeight: 500, flexShrink: 0,
                      }}>{date}</span>
                      <div style={{ flex: 1, height: 1, background: 'var(--border-primary)' }} />
                    </div>

                    {items.map(qa => (
                      <div key={qa.id} style={{ marginBottom: 16 }}>
                        {/* 토픽 태그 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                          {qa.badge && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              fontSize: 10, fontWeight: 700,
                              padding: '2px 8px', borderRadius: 20,
                              background: 'rgba(249,115,22,0.1)',
                              color: '#f97316',
                              border: '1px solid rgba(249,115,22,0.25)',
                            }}>
                              <MIcon name="build_circle" size={10} />
                              {qa.badge}
                            </span>
                          )}
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 11, fontWeight: 700,
                            padding: '3px 10px', borderRadius: 20,
                            background: 'rgba(59,130,246,0.08)',
                            color: 'var(--accent-blue)',
                            border: '1px solid rgba(59,130,246,0.2)',
                          }}>
                            <MIcon name="bookmark" size={11} />
                            {qa.topic}
                          </span>
                        </div>

                        {/* 질문 */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                          <div style={{ ...userBubbleStyle, maxWidth: '80%' }}>
                            <span style={{ fontSize: 13, color: '#fff', lineHeight: 1.5 }}>{qa.question}</span>
                          </div>
                        </div>

                        {/* 답변 */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <AiAvatar />
                          <div style={{ ...aiBubbleStyle, flex: 1, fontSize: 13 }}
                            dangerouslySetInnerHTML={{ __html: qa.answerHtml }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 저장 토스트 */}
        {savedToast && (
          <div style={{
            position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--bg-elevated)', color: 'var(--text-primary)',
            padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 500,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)', border: '1px solid var(--border-primary)',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            animation: 'cpFadeIn 0.2s ease',
          }}>
            <MIcon name="check_circle" size={16} style={{ color: 'var(--color-success)' }} />
            아카이브에 저장되었습니다
          </div>
        )}
      </div>

      <style>{`
        @keyframes cpDot {
          0%, 60%, 100% { opacity: 0.25; transform: scale(0.85); }
          30% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes cpFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .bubble-ai h4 { color: var(--text-primary); font-size: 12px; font-weight: 700; margin: 12px 0 5px; }
        .bubble-ai h4:first-child { margin-top: 0; }
        .bubble-ai p { margin: 4px 0; font-size: 13px; color: var(--text-secondary); line-height: 1.65; }
        .bubble-ai ul { padding-left: 16px; margin: 6px 0; }
        .bubble-ai li { margin-bottom: 3px; font-size: 13px; color: var(--text-secondary); }
        .bubble-ai strong { color: var(--text-primary); }
        .bubble-ai code { background: var(--bg-tertiary); padding: 1px 5px; border-radius: 4px; font-size: 12px; font-family: monospace; }
        .tbl { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0; border-radius: 6px; overflow: hidden; }
        .tbl th { background: var(--bg-tertiary); color: var(--text-secondary); font-weight: 600; padding: 6px 10px; border-bottom: 1px solid var(--border-primary); text-align: left; }
        .tbl td { padding: 6px 10px; border-bottom: 1px solid var(--bg-tertiary); color: var(--text-secondary); }
        .tbl tr:last-child td { border-bottom: none; }
        .tbl td.g, .tbl th.g { color: var(--color-profit); font-weight: 700; }
        .tbl td.r, .tbl th.r { color: var(--color-loss); font-weight: 700; }
        .tbl td.o, .tbl th.o { color: #f97316; font-weight: 700; }
        .tbl td.b, .tbl th.b { color: var(--accent-blue); font-weight: 700; }
        .note { background: rgba(59,130,246,0.07); border-left: 3px solid var(--accent-blue); border-radius: 0 6px 6px 0; padding: 8px 12px; margin: 8px 0; font-size: 12px; color: var(--text-secondary); line-height: 1.6; }
        .warn { background: rgba(249,115,22,0.07); border-left: 3px solid #f97316; border-radius: 0 6px 6px 0; padding: 8px 12px; margin: 8px 0; font-size: 12px; color: var(--text-secondary); line-height: 1.6; }
        .tip  { background: rgba(34,197,94,0.07); border-left: 3px solid #22c55e; border-radius: 0 6px 6px 0; padding: 8px 12px; margin: 8px 0; font-size: 12px; color: var(--text-secondary); line-height: 1.6; }
        .tag { display: inline-block; font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 4px; margin-right: 3px; }
        .tag-g { background: rgba(34,197,94,0.15); color: var(--color-profit); }
        .tag-r { background: rgba(239,68,68,0.12); color: var(--color-loss); }
        .tag-b { background: rgba(59,130,246,0.12); color: var(--accent-blue); }
        .tag-o { background: rgba(249,115,22,0.12); color: #f97316; }
        .tag-y { background: rgba(234,179,8,0.12); color: #ca8a04; }
      `}</style>
    </>
  );
}

function AiAvatar() {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
      background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <MIcon name="smart_toy" size={16} style={{ color: '#fff' }} />
    </div>
  );
}

const aiBubbleStyle: React.CSSProperties = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-primary)',
  borderRadius: '4px 16px 16px 16px',
  padding: '10px 14px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const userBubbleStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
  borderRadius: '16px 4px 16px 16px',
  padding: '10px 14px',
};

const iconBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
  background: 'transparent', color: 'var(--text-tertiary)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 0.15s',
};

function ArchiveMatchBlock({ matches }: { matches: ArchivedQA[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* 섹션 레이블 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
        <MIcon name="bookmarks" size={13} style={{ color: 'var(--accent-blue)' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)' }}>
          관련 저장 대화 {matches.length}건
        </span>
      </div>

      {/* 요약 카드 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {matches.map(qa => {
          const isExpanded = expandedId === qa.id;
          return (
            <div key={qa.id} style={{
              borderRadius: 10,
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-primary)',
              overflow: 'hidden',
              transition: 'box-shadow 0.15s',
            }}>
              {/* 카드 헤더 — 항상 표시 */}
              <button onClick={() => setExpandedId(isExpanded ? null : qa.id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 12px', border: 'none', cursor: 'pointer',
                background: isExpanded ? 'rgba(59,130,246,0.07)' : 'transparent',
                fontFamily: 'inherit', textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
              onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* 시스템 배지 */}
                {qa.badge && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, flexShrink: 0,
                    padding: '2px 7px', borderRadius: 20,
                    background: 'rgba(249,115,22,0.1)',
                    color: '#f97316',
                    border: '1px solid rgba(249,115,22,0.25)',
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    <MIcon name="build_circle" size={10} />
                    {qa.badge}
                  </span>
                )}
                {/* 토픽 배지 */}
                <span style={{
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                  padding: '2px 8px', borderRadius: 20,
                  background: 'rgba(59,130,246,0.1)',
                  color: 'var(--accent-blue)',
                  border: '1px solid rgba(59,130,246,0.2)',
                }}>{qa.topic}</span>
                {/* 질문 요약 */}
                <span style={{
                  fontSize: 12, color: 'var(--text-secondary)',
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{qa.question}</span>
                <MIcon
                  name={isExpanded ? 'expand_less' : 'expand_more'}
                  size={16}
                  style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
                />
              </button>

              {/* 펼쳐진 상세 내용 */}
              {isExpanded && (
                <div style={{
                  borderTop: '1px solid var(--border-primary)',
                  padding: '10px 12px',
                  background: 'var(--bg-primary)',
                }}>
                  <div style={{
                    fontSize: 12, color: 'var(--text-secondary)',
                    fontStyle: 'italic', marginBottom: 8,
                    padding: '5px 9px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 6,
                  }}>Q. {qa.question}</div>
                  <div className="bubble-ai" style={{ fontSize: 12 }}
                    dangerouslySetInnerHTML={{ __html: qa.answerHtml }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
