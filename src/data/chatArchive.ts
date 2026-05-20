export interface ArchivedQA {
  id: string;
  date: string;
  topic: string;
  question: string;
  answerHtml: string;
  badge?: string; // '시스템' 등 카테고리 배지
}

export const INITIAL_ARCHIVE: ArchivedQA[] = [
  {
    id: 'q1',
    date: '2026-05-06',
    topic: '보유 금지 액션',
    question: '보유 금지이면 다 팔아야 해?',
    answerHtml: `<p>네, <strong style="color:#ef4444">전량 매도</strong>가 맞습니다.</p>
<p>이 전략은 <span class="tag tag-b">Top-1 집중 전략</span>입니다. 매월 7개 자산 중 6M 수익률 1위 자산 <strong>하나만</strong> 보유합니다.</p>
<table class="tbl"><tr><th>액션</th><th>대상</th><th>설명</th></tr>
<tr><td class="g">✓ 보유 유지</td><td>1위 자산</td><td>6M 모멘텀 1위만 100% 유지</td></tr>
<tr><td class="r">✕ 보유 금지 → 매도</td><td>2~7위 자산</td><td>현재 보유 중이면 전량 매도 후 1위 자산으로 통합</td></tr></table>
<div class="note">절대 모멘텀이 음수(6M &lt; 0)이면 전 자산 매도 후 <strong>단기채권(153130)</strong>으로 전환</div>`,
  },
  {
    id: 'q2',
    date: '2026-05-06',
    topic: '고점 매수 리스크',
    question: '반도체 섹터가 지금 사상최고가인데, 여기로 자산을 몰면 고점에 물리지 않을까?',
    answerHtml: `<p>퀀트적으로 정확히 짚어낸 질문입니다. 결론: <strong>"그럴 수 있다. 단, 그게 모멘텀 전략의 구조적 특성이고 보호 장치가 있다"</strong></p>
<h4>왜 모멘텀 전략은 사상최고가에 매수하나</h4>
<table class="tbl"><tr><th>사고방식</th><th>논리</th><th>전략 유형</th></tr>
<tr><td>"사상최고가 = 곧 꺾인다"</td><td>평균회귀</td><td>가치투자·역추세</td></tr>
<tr><td>"사상최고가 = 트렌드 강세"</td><td>추세추종</td><td class="g">듀얼 모멘텀 (현재 전략)</td></tr></table>
<p>Jegadeesh &amp; Titman (1993): 과거 수익률 상위 자산이 향후 3~12개월 지속 초과수익. ATH 자체는 반전 신호가 아닙니다.</p>
<h4>진짜 리스크 — 모멘텀 크래시</h4>
<div class="warn"><strong>반도체 6M +137%</strong> → 상위 1~2% 수준의 극단 모멘텀<br>Barroso &amp; Santa-Clara (2015): 극단 모멘텀 이후 크래시 확률 통계적으로 유의미하게 상승</div>
<h4>전략의 보호 장치</h4>
<ul><li><span class="tag tag-g">월말 자동 교체</span> 매월 말 6M 수익률 재계산 → 1위 변경 시 다음 달 초 교체</li>
<li><span class="tag tag-o">크래시 탐지</span> 3M 급락 신호 → 단기채권 즉시 전환 트리거</li></ul>
<table class="tbl"><tr><th>항목</th><th>내용</th></tr>
<tr><td>고점 매수 자체</td><td>모멘텀 전략의 의도된 설계</td></tr>
<tr><td>실제 위험</td><td>모멘텀 크래시 (극단 모멘텀 후 급반전)</td></tr>
<tr><td>현재 상황</td><td class="r">+137% 경계 수준 — 크래시 탐지 자주 확인 필요</td></tr>
<tr><td>대응</td><td>월말 신호 재계산 + 크래시 탐지 주 2회 점검</td></tr></table>`,
  },
  {
    id: 'q3',
    date: '2026-05-06',
    topic: 'UI 위치 안내',
    question: '크래시 탐지 섹션은 어딨어?',
    answerHtml: `<p><strong>퀀트 대시보드</strong> 탭 → 아래로 스크롤 → <strong>"모멘텀 크래시 감지"</strong> 섹션입니다.</p>
<table class="tbl"><tr><th>신호</th><th>조건</th><th>의미</th></tr>
<tr><td>🟢 상승 유지</td><td>3M &gt; 0 &amp; 6M &gt; 0</td><td class="g">추세 정상</td></tr>
<tr><td>🟡 경고</td><td>혼재 또는 약세</td><td class="o">주의 모니터링</td></tr>
<tr><td>🔴 크래시 위험</td><td>3M &lt; -5% 또는 3M·6M 동반 하락</td><td class="r">즉시 단기채권 전환</td></tr></table>`,
  },
  {
    id: 'q4',
    date: '2026-05-06',
    topic: '갱신 주기',
    question: '모멘텀 크래시 감지... 주기는...?',
    answerHtml: `<p><span class="tag tag-b">하루 1회</span> — 매일 UTC 03:00 (한국시간 자정) Cloudflare Worker 크론이 돌면서 모멘텀 신호·크래시 신호를 함께 갱신합니다.</p>
<div class="warn"><strong>한계:</strong> 전날 데이터 기준으로 표시됩니다.<br>반도체가 <strong>장중 급락</strong>해도 다음 날 새벽 업데이트 전까지 신호가 바뀌지 않습니다.</div>
<p>반도체 +137% 같은 극단 모멘텀 구간에서는 일중 급락 대응이 늦을 수 있습니다.<br><strong>퀀트투자 기초 → 리밸런싱 액션 플랜 → 🔄 신호 갱신</strong> 버튼으로 수동 업데이트 가능합니다.</p>`,
  },
  {
    id: 'q5',
    date: '2026-05-06',
    topic: 'ETF 선택',
    question: '저 티커(091160)가 반도체 ETF 중 가장 좋은 거야?',
    answerHtml: `<p><strong>091160 KODEX 반도체</strong>는 <span class="tag tag-o">전략 신호의 기준 티커</span>입니다. "가장 좋은 ETF"는 별개 문제입니다.</p>
<h4>국내 반도체 ETF 비교</h4>
<table class="tbl"><tr><th>ETF</th><th>코드</th><th>핵심 구성</th><th>특징</th></tr>
<tr><td><strong>KODEX 반도체</strong></td><td class="b">091160</td><td>삼성전자 ~45%, SK하이닉스 ~25%</td><td>대형주 중심. 삼성전자 ETF에 가까움</td></tr>
<tr><td><strong>TIGER 반도체</strong></td><td class="b">091230</td><td>비슷한 구성</td><td>091160과 거의 동일</td></tr>
<tr><td><strong>KODEX AI반도체핵심장비</strong></td><td class="b">266410</td><td>한미반도체, 리노공업, 원익IPS 장비주</td><td>중소형 장비주. 변동성·수익률 모두 큼</td></tr>
<tr><td><strong>TIGER 미국필라델피아반도체</strong></td><td class="b">381180</td><td>엔비디아, TSMC, AMD, 브로드컴</td><td>글로벌. 엔비디아 강세 구간 압도적</td></tr></table>
<div class="warn"><strong>091160의 문제:</strong> 삼성전자 비중이 너무 높아서 반도체 섹터 전체가 올라도 삼성전자 부진 시 수익률 낮음</div>
<div class="note"><strong>핵심 주의:</strong> 다른 ETF로 보유 시 신호 기준 티커(091160)와 실제 보유 ETF의 수익률이 괴리됩니다.<br>ETF를 바꾸려면 Worker의 기준 티커도 함께 변경해야 일관성이 유지됩니다.</div>`,
  },
  {
    id: 'q6',
    date: '2026-05-06',
    topic: '분산 전략',
    question: '여러 종목에 분산하면 어때?',
    answerHtml: `<p>좋은 발상이지만 <strong>어떤 분산이냐</strong>에 따라 효과가 완전히 다릅니다.</p>
<h4>케이스 1 — 반도체 ETF 여러 개 동시 보유</h4>
<table class="tbl"><tr><th>조합</th><th>상관계수</th><th>분산 효과</th></tr>
<tr><td>091160 ↔ 091230</td><td class="r">0.97</td><td class="r">없음 (거의 동일)</td></tr>
<tr><td>091160 ↔ 381180</td><td class="o">0.75~0.80</td><td class="o">미미함</td></tr>
<tr><td>091160 ↔ 266410</td><td class="o">0.82~0.88</td><td class="o">미미함</td></tr></table>
<div class="warn">반도체 사이클이 꺾이면 세 ETF 모두 같이 떨어집니다. 같은 섹터 안에서 나누는 건 진짜 분산이 아닙니다.</div>
<h4>케이스 2 — 모멘텀 비례 배분 (Top-3 동시 보유)</h4>
<p>현재 전략(Top-1) 대신 <strong>퀀트투자 기초 → 포트폴리오 최적화 → "모멘텀 비례 배분"</strong>으로 전환하는 방식입니다.</p>
<table class="tbl"><tr><th>지표</th><th>Top-1 집중</th><th>모멘텀 비례 분산</th></tr>
<tr><td>CAGR</td><td class="g">~22%</td><td class="g">~18%</td></tr>
<tr><td>MDD</td><td class="r">-30~45%</td><td class="o">-18~35%</td></tr>
<tr><td>Sharpe</td><td>0.70~0.95</td><td class="g">0.75~1.00</td></tr>
<tr><td>턴오버</td><td>~120%/년</td><td>~80%/년</td></tr></table>
<div class="tip"><strong>결론:</strong> 반도체 ETF를 여러 개로 나누는 건 분산 효과 없음.<br>진짜 분산은 <strong>Top-1 → 모멘텀 비례 배분으로 전환</strong>하는 것. MDD 개선 + Sharpe 향상.<br>+137% 극단 모멘텀 구간에서는 비례 배분이 크래시 충격 완화에 유리합니다.</div>`,
  },
  {
    id: 'q8',
    date: '2026-05-20',
    topic: '차트 지표 해설',
    question: 'MA20 아래로 이탈 — 단기 약세. 골든크로스(MA20>MA60)는 유지 중이므로 MA20 회복 여부 관망. 60일 범위 68% 위치. 자세히 설명해봐.',
    answerHtml: `
<h4>현재 상태 수치</h4>
<table class="tbl"><tr><th>지표</th><th>값</th><th>의미</th></tr>
<tr><td>현재가</td><td class="r">MA5·MA20 아래</td><td>단기 평균 아래 위치</td></tr>
<tr><td>MA20</td><td class="o">20일 이동평균</td><td>지난 한 달 평균 매수 단가</td></tr>
<tr><td>MA60</td><td class="g">60일 이동평균</td><td>중장기 추세선. 현재가 위에 있음</td></tr></table>

<h4>① MA20 아래로 이탈 — 단기 약세</h4>
<p>MA20은 <strong>최근 한 달 동안 이 종목을 산 사람들의 평균 단가</strong>입니다. 현재가가 MA20 아래라는 것은 지난 달 매수자 대부분이 손실 상태 → <strong>매도 압력 우위 구간</strong>.</p>

<h4>② 골든크로스(MA20 &gt; MA60) 유지 중</h4>
<p>골든크로스는 <strong>단기선(MA20)이 장기선(MA60) 위에 있는 상태</strong>입니다.</p>
<table class="tbl"><tr><th>크로스</th><th>조건</th><th>의미</th></tr>
<tr><td>골든크로스</td><td class="g">MA20 &gt; MA60</td><td>중장기 상승 추세 유지</td></tr>
<tr><td>데드크로스</td><td class="r">MA20 &lt; MA60</td><td>중장기 추세 전환·약세</td></tr></table>
<div class="note">골든크로스가 유지된다는 것은 <strong>추세 전환이 아닌 일시적 조정</strong>일 가능성을 지지합니다.</div>

<h4>③ MA20 회복 여부 관망</h4>
<p>현재가가 MA20 위로 <strong>회복하면 → 상승 재개 신호</strong>, 실패하면 → MA60 지지 여부 추가 확인 필요.</p>
<table class="tbl"><tr><th>시나리오</th><th>판단</th></tr>
<tr><td>현재가 &gt; MA20 회복</td><td class="g">골든크로스 + 주가 MA20 위 → 상승 재개 신호</td></tr>
<tr><td>MA20 회복 실패 반복</td><td class="o">MA60 이탈 전 분할 축소 검토</td></tr>
<tr><td>MA60 이탈</td><td class="r">데드크로스 위험, 추세 전환 경계</td></tr></table>

<h4>④ 60일 범위 68% 위치</h4>
<p>최근 60일 <strong>최저가~최고가 범위</strong>에서 현재가의 백분율 위치입니다.</p>
<div class="tip">68%는 하단에서 상위권에 해당합니다. 고점 대비 조정이지만 <strong>전체 범위로는 중상위</strong>. 폭락이 아닌 고점 조정 수준.</div>

<h4>종합 해석</h4>
<table class="tbl"><tr><th>시각</th><th>상태</th></tr>
<tr><td>단기</td><td class="r">MA5·MA20 이탈 → 매도 압력 우위</td></tr>
<tr><td>중기</td><td class="g">골든크로스 유지 + 60일 68% → 추세 양호</td></tr>
<tr><td>판단</td><td class="o">MA20 회복 여부가 핵심 분기점 → 관망</td></tr></table>`,
  },
  {
    id: 'q7',
    date: '2026-05-14',
    topic: 'MA20 회복 여부 판단',
    question: 'AI 의견에서 "MA20 회복 여부를 관망"이라고 하는데, MA20 회복 여부는 무엇으로 판단해?',
    answerHtml: `<p><strong>"MA20 회복 여부"는 다음 날 앱을 새로고침할 때 자동으로 판단됩니다.</strong></p>
<h4>판단 기준</h4>
<table class="tbl"><tr><th>조건</th><th>상태</th></tr>
<tr><td><code>현재가 &lt; MA20</code> &amp; <code>MA20 &gt; MA60</code></td><td class="o">추세 꺾임 → "MA20 회복 관망" 메시지 표시</td></tr>
<tr><td><code>현재가 &gt; MA20</code> &amp; <code>MA20 &gt; MA60</code></td><td class="g">상승 추세 → 회복된 것으로 판단</td></tr></table>
<p>즉, <strong>현재가가 MA20 위로 올라오면</strong> 자동으로 상태가 <span class="tag tag-o">추세 꺾임</span> → <span class="tag tag-g">상승 추세</span>로 바뀌고, "MA20 회복 관망" 문구 대신 "MA20 지지선 위 보유 원칙" 메시지로 전환됩니다.</p>
<div class="note"><strong>별도 알림이나 판단 버튼은 없습니다.</strong><br>매일 앱에서 종목 차트를 열었을 때 상태 레이블이 바뀌어 있으면 회복된 것입니다.</div>
<h4>배경 — 추세 꺾임 조건</h4>
<ul><li><code>!aboveMa20</code> = 현재가가 MA20 아래 (단기 약세)</li>
<li><code>ma20AboveMa60</code> = MA20이 MA60 위 (골든크로스 유지, 중기 강세)</li></ul>
<p>이 두 조건이 동시에 성립하면 <span class="tag tag-o">추세 꺾임</span> 상태가 됩니다. 현재가가 MA20을 회복하면 자동으로 <span class="tag tag-g">상승 추세</span>로 전환됩니다.</p>`,
  },

  // ── 시스템 항목 ──────────────────────────────────────────────
  {
    id: 'sys1',
    date: '2026-05-20',
    badge: '시스템',
    topic: '대시보드 증감 0원 문제',
    question: '대시보드에서 5월 18일·19일 증감이 0원으로 나와. 왜 그래?',
    answerHtml: `
<p><strong>원인:</strong> 백필(자동 복원)로 만들어진 스냅샷에 <code>assetChange: 0</code>이 저장되어 있고, 대시보드가 당일(i===0) 외에는 KV 저장값을 그대로 사용했기 때문입니다.</p>
<h4>수정 내용 (NewDashboard.tsx)</h4>
<table class="tbl"><tr><th>위치</th><th>수정 전</th><th>수정 후</th></tr>
<tr><td>모바일 카드 ~279줄</td><td class="r">i===0 일 때만 prev 비교</td><td class="g">항상 prev 비교</td></tr>
<tr><td>데스크톱 테이블 ~330줄</td><td class="r">i===0 일 때만 prev 비교</td><td class="g">항상 prev 비교</td></tr></table>
<div class="note"><strong>적용 패턴:</strong><br>
<code>const change = prev ? snap.totalAsset - prev.totalAsset : snap.assetChange;</code><br>
<code>const rate = prev &amp;&amp; prev.totalAsset &gt; 0 ? (change / prev.totalAsset) * 100 : snap.changeRate;</code>
</div>
<p>다시 0원이 표시되면 NewDashboard.tsx의 두 위치가 위 패턴으로 되어 있는지 확인하세요.</p>`,
  },
  {
    id: 'sys2',
    date: '2026-05-20',
    badge: '시스템',
    topic: '누락 스냅샷 복원 방법',
    question: '주말·공휴일 또는 크론 실패로 날짜 데이터가 빠져있어. 어떻게 복원해?',
    answerHtml: `
<h4>복원 절차</h4>
<table class="tbl"><tr><th>단계</th><th>내용</th></tr>
<tr><td>1</td><td><strong>데이터 보고서</strong> 페이지 이동</td></tr>
<tr><td>2</td><td>우측 상단 <span class="tag tag-b">누락 복원</span> 버튼 클릭 (history 아이콘)</td></tr>
<tr><td>3</td><td>Worker가 네이버 일별 종가 조회 → 최근 14일 중 누락된 날짜 자동 복원</td></tr>
<tr><td>4</td><td>복원 완료 후 <code>snapshotsUpdated</code> 이벤트 → 대시보드 자동 갱신</td></tr></table>
<div class="note"><strong>자동 스킵:</strong> 주말·공휴일처럼 주가 데이터가 없는 날짜는 건너뜁니다.</div>
<div class="warn"><strong>KV BOM 주의:</strong> Worker에서 KV 읽을 때 반드시 <code>parseKV()</code> 사용. <code>JSON.parse()</code> 직접 사용 시 <code>SyntaxError: Unexpected token '﻿'</code> 발생.</div>
<h4>복원 후 증감이 여전히 0원이면</h4>
<p>→ <strong>sys1 (대시보드 증감 0원 문제)</strong> 항목 참고. NewDashboard.tsx 패턴 확인 필요.</p>`,
  },
  {
    id: 'sys3',
    date: '2026-05-20',
    badge: '시스템',
    topic: '데이터 보고서 날짜 고정 버그',
    question: '데이터 보고서에서 날짜를 바꿔도 항상 5월 15일 데이터만 나와. 어떻게 고쳐?',
    answerHtml: `
<p><strong>원인:</strong> <code>generateDailyReport</code>가 <code>enriched[0]</code> fallback을 사용해 날짜 필터 없이 항상 최신 스냅샷을 반환했습니다.</p>
<h4>수정 내용 (worker/src/index.ts)</h4>
<table class="tbl"><tr><th>항목</th><th>내용</th></tr>
<tr><td>수정 전</td><td class="r"><code>const snap = enriched.find(s =&gt; s.date === date) || enriched[0];</code></td></tr>
<tr><td>수정 후</td><td class="g"><code>const relevant = enriched.filter(s =&gt; s.date &lt;= date);</code><br><code>const snap = relevant[0];</code><br><code>if (!snap) return \`[\${date}] 저장된 데이터 없음\`;</code></td></tr></table>
<div class="note">날짜보다 오래된 스냅샷만 필터링해서 해당 날짜 기준 최신값을 사용합니다. 스냅샷이 존재하지 않는 날짜는 "저장된 데이터 없음" 메시지 반환.</div>
<h4>재발 방지 — 날짜별 재생성</h4>
<p>데이터 보고서 각 카드의 <span class="tag tag-b">재생성</span> 버튼을 누르면 해당 날짜의 스냅샷 기준으로 보고서를 다시 생성합니다.<br>
전체 재생성이 필요하면 <span class="tag tag-b">전체 재생성</span> 버튼(sync 아이콘)을 사용하세요.</p>`,
  },
];

const LS_KEY = 'chatArchive_v1';

export function loadArchive(): ArchivedQA[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const saved: ArchivedQA[] = raw ? JSON.parse(raw) : [];
    return [...INITIAL_ARCHIVE, ...saved];
  } catch {
    return [...INITIAL_ARCHIVE];
  }
}

export function saveToArchive(qa: ArchivedQA): void {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const saved: ArchivedQA[] = raw ? JSON.parse(raw) : [];
    saved.push(qa);
    localStorage.setItem(LS_KEY, JSON.stringify(saved));
  } catch {}
}
