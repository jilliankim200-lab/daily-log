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

  // ── 투자 판단 ─────────────────────────────────────────────────
  {
    id: 'inv1',
    date: '2026-05-20',
    topic: '매도 타이밍 — 급락장',
    question: '오늘 코스닥이 떨어지고 있는데 오늘 팔아야 해? 내일 오르면 팔면 안 되고?',
    answerHtml: `
<h4>전략 원칙 — 손절 기준 도달 = 이미 결론</h4>
<p>손절 기준(-10%)은 미래 예측이 아니라 <strong>사전에 정한 규칙</strong>입니다. 기준을 넘은 순간 전략은 이미 "판다"고 완료한 것입니다.</p>
<table class="tbl"><tr><th>시나리오</th><th>결과</th></tr>
<tr><td>내일 실제로 오른다</td><td class="o">다음에도 같은 논리로 손절 미룸 → 규칙 붕괴</td></tr>
<tr><td>내일도 떨어진다</td><td class="r">-12%, -15%로 손실 확대</td></tr>
<tr><td>잠깐 오르다 재하락</td><td class="r">타이밍 놓치고 원점</td></tr></table>
<div class="warn"><strong>앵커 바이어스(닻 내림 편향)</strong><br>"조금만 더 기다리면"이라는 심리가 손절 규칙을 무력화합니다. 통계적으로 손절을 미루면 손실이 줄어드는 게 아니라 커지는 경우가 더 많습니다.</div>

<h4>현실적인 타이밍 조정 — "언제" 팔 것인가</h4>
<p>단, <strong>오늘 코스닥이 급락 중</strong>이라면 체결가 관점에서 타이밍 조정이 합리적입니다.</p>
<table class="tbl"><tr><th>상황</th><th>권장 행동</th></tr>
<tr><td>장중 급락 중 (낙폭 큰 시간대)</td><td class="o">저점에 팔면 최악의 가격에 체결 → 잠시 대기</td></tr>
<tr><td>오늘 장 마감 30분 전</td><td class="g">가격이 안정되는 경향 → 매도 실행 권장</td></tr>
<tr><td>내일 시가 직후</td><td class="g">갭 없이 출발하면 안정적인 체결가 기대 가능</td></tr></table>
<div class="note"><strong>앱의 급등락일 경고</strong>도 이 이유로 표시됩니다. 급락일에 장중 매도는 손절보다 나쁜 가격이 될 수 있습니다.</div>

<h4>결론</h4>
<table class="tbl"><tr><th>질문</th><th>답</th></tr>
<tr><td>팔 것인가 말 것인가</td><td class="r">전략상 결정: 판다</td></tr>
<tr><td>"내일 오르면 판다"</td><td class="r">조건부 대기 = 손절 규칙 포기와 같음</td></tr>
<tr><td>"내일 시가에 판다"</td><td class="g">타이밍 조정 = 합리적</td></tr></table>`,
  },
  {
    id: 'inv2',
    date: '2026-05-20',
    topic: '최적 가이드 — 매도 신호 기준',
    question: '60일 포지션 60% 이상이 무슨 말이야?',
    answerHtml: `
<p>최근 60일 <strong>최저가~최고가 범위</strong>에서 현재가가 어느 위치에 있는지를 0~100%로 나타낸 값입니다.</p>
<h4>공식</h4>
<div class="note"><code>포지션 = (현재가 − 60일 저점) ÷ (60일 고점 − 60일 저점)</code></div>
<h4>예시</h4>
<table class="tbl"><tr><th>60일 저점</th><th>60일 고점</th><th>현재가</th><th>포지션</th></tr>
<tr><td>30,000원</td><td>42,000원</td><td>37,200원</td><td class="o">60% (중상위)</td></tr>
<tr><td>30,000원</td><td>42,000원</td><td>34,800원</td><td class="g">40% (중간)</td></tr>
<tr><td>30,000원</td><td>42,000원</td><td>40,800원</td><td class="r">90% (고점권)</td></tr></table>
<h4>매도 신호와의 연결</h4>
<p>최적 가이드의 매도 판정 로직에는 다음 조건이 추가되어 있습니다:</p>
<table class="tbl"><tr><th>조건</th><th>판정</th></tr>
<tr><td>현재가 &lt; MA20 (추세 꺾임)</td><td rowspan="2" class="o">→ <strong>분할 매도 권유</strong></td></tr>
<tr><td>60일 포지션 ≥ 60% (고점 구간)</td></tr>
<tr><td>MA20 &lt; MA60 (추세 붕괴)</td><td class="r">→ 전량 매도 권유</td></tr></table>
<div class="note">포지션이 60% 미만이면 추세 꺾임이 일어나도 "고점 구간이 아니다"로 보고 매도를 권유하지 않습니다. 포지션이 높을수록 고점에서 팔 기회로 판단합니다.</div>`,
  },
  {
    id: 'inv3',
    date: '2026-05-20',
    topic: '최적 가이드 — 필터 ON/OFF 전략',
    question: '최적 가이드 필터 ON/OFF는 어떻게 다르고, 각 조건이 뭔지 알고 싶어.',
    answerHtml: `
<h4>필터 ON — 기술적 분석 기반 절세 정리</h4>
<p>중복 종목 중 <strong>지금 실제로 팔기 좋은 타이밍인 것만</strong> 추려냅니다. MA(이동평균) 기준으로 아래 순서대로 판단하며, 중복 제거이므로 수량과 무관하게 전량 매도입니다.</p>
<table class="tbl">
<tr><th>단계</th><th>조건</th><th>판정</th></tr>
<tr><td class="g">① 홀딩 우선</td><td>현재가 &gt; MA20</td><td class="g">상승 중 → 매도 보류</td></tr>
<tr><td class="r">② 추세 붕괴</td><td>MA20 &lt; MA60</td><td class="r">전량 매도</td></tr>
<tr><td class="o">② 추세 꺾임</td><td>현재가 &lt; MA20 + 60일 포지션 ≥ 60%</td><td class="o">분할 매도</td></tr>
<tr><td class="r">③ 손절</td><td>수익률 ≤ −10% (기본값)</td><td class="r">전량 매도</td></tr>
<tr><td class="o">④ 수익 실현</td><td>수익률 ≥ +20% (기본값) + 추세 꺾임</td><td class="o">분할 매도</td></tr>
</table>
<div class="note">손절 기준과 목표 수익률은 최적 가이드 상단 슬라이더로 조정할 수 있습니다. 기본값: 손절 −10%, 목표 +20%.</div>

<h4>필터 OFF — 변동성 수확 전략</h4>
<p>추세·중복 여부에 상관없이 <strong>수익률이 충분히 쌓이면 분할 익절</strong>하고, <strong>당일 급락 시 분할 매수</strong>합니다.</p>
<table class="tbl">
<tr><th colspan="2" class="r">📤 분할매도 — 수익률 기준</th></tr>
<tr><td>+20% ~ +35%</td><td>보유의 1/4 매도</td></tr>
<tr><td>+35% ~ +50%</td><td>보유의 1/3 매도</td></tr>
<tr><td>+50% 이상</td><td>보유의 1/2 매도</td></tr>
</table>
<table class="tbl" style="margin-top:8px">
<tr><th colspan="2" class="g">📥 분할매수 — 당일 하락률 기준</th></tr>
<tr><td>−2% ~ −3%</td><td>가용현금의 1/4 매수</td></tr>
<tr><td>−3% ~ −5%</td><td>가용현금의 1/3 매수</td></tr>
<tr><td>−5% 이상</td><td>가용현금의 1/2 매수</td></tr>
</table>
<div class="note">가용현금 = 계좌 현금 + 이번 사이클 분할매도 예정금</div>

<h4>어떤 걸 써야 할까?</h4>
<table class="tbl">
<tr><th>상황</th><th>권장</th></tr>
<tr><td>지금이 매도 타이밍인지 기술적으로 판단받고 싶을 때</td><td class="g">필터 ON</td></tr>
<tr><td>수익 기준만으로 단순하게 익절·손절하고 싶을 때</td><td class="o">필터 OFF</td></tr>
</table>`,
  },

  // ── 투자 루틴 ──
  {
    id: 'ir1',
    date: '2026-05-28',
    topic: '미 10년물 국채 금리',
    badge: '투자루틴',
    question: '미 10년물 국채 금리가 뭐야? 왜 확인해야 해?',
    answerHtml: `<p><strong>미 10년물 국채 금리</strong>는 전 세계 돈의 기준입니다. 모든 자산 가격이 여기에 연결됩니다.</p>
<h4>금리가 움직이면 시장도 움직인다</h4>
<table class="tbl">
<tr><th>방향</th><th>의미</th><th>시장 반응</th></tr>
<tr><td class="r">금리 상승 ↑</td><td>기업 차입비용·할인율 증가</td><td class="r">주가 하락 압력 — 특히 성장주</td></tr>
<tr><td class="g">금리 하락 ↓</td><td>채권 매력 하락</td><td class="g">주식 매력 상승 → 시장 자금 유입</td></tr>
<tr><td class="o">금리 급변동</td><td>시장 불확실성 확대</td><td class="o">섣불리 매매 자제, 관망 우선</td></tr>
</table>
<div class="note">"국채 4~5% 받으면 굳이 위험한 주식을?" — 이 심리가 시장을 움직입니다. 금리가 높을수록 주식의 상대 매력이 떨어집니다.</div>
<h4>매일 루틴에서 확인하는 법</h4>
<ul>
<li>전일 대비 <strong>방향</strong>이 중요 — 숫자 자체보다 "오르고 있나 내리고 있나"</li>
<li>3.8% → 4.3%처럼 <strong>0.5%p 이상 급변동</strong>이면 시장 기류 변화 신호</li>
<li>금리 급등 시 → 보유 성장주 리스크 재점검</li>
</ul>
<div class="tip"><strong>결론:</strong> 미 10년물 금리는 매일 아침 확인해야 할 첫 번째 숫자입니다. 절대값보다 <strong>전일 대비 방향과 변화폭</strong>에 집중하세요.</div>`,
  },
  {
    id: 'ir2',
    date: '2026-05-28',
    topic: '아침 시황 루틴',
    badge: '투자루틴',
    question: '아침에 뭘 확인해야 해? 시황 체크 루틴 알려줘',
    answerHtml: `<p>매일 아침 <strong>4가지</strong>를 순서대로 확인합니다. 뉴스를 보되, 해석은 천천히 — 제목에 휘둘리지 마십시오.</p>
<h4>① 세계 시장 뉴스 훑기</h4>
<ul>
<li>뉴욕 증시 방향 확인 (상승/하락/보합)</li>
<li><strong>"삼성전자 실적 쇼크"</strong> 같은 기사는 실제 공시를 직접 확인 — 헤드라인에 속지 말 것</li>
</ul>
<h4>② 환율 확인</h4>
<ul>
<li>원/달러 전일 대비 변화폭</li>
<li>환율 급등(원화 약세) → 외국인 자금 이탈 신호 → 코스피 하락 압력</li>
</ul>
<h4>③ 미국 10년물 국채 금리</h4>
<ul>
<li>금리 상승 → 기업 비용 증가 → 주가 하락 압력</li>
<li>금리 하락 → 주식 매력 상승 → 시장 자금 유입</li>
<li>금리 급변동 시 → 섣불리 매매 자제</li>
</ul>
<h4>④ 주요 기업 주가 체크</h4>
<ul>
<li>NVDA (AI 온도계), 빅테크 5총사, JPM·WMT, 삼성전자·SK하이닉스</li>
<li>변동폭이 컸던 종목 이유 한 줄 파악</li>
</ul>
<div class="note">아침 루틴은 <strong>30분 이내</strong>로 끝내는 것이 좋습니다. 시황 분석에 매몰되면 감정적 판단이 늘어납니다.</div>`,
  },
  {
    id: 'ir3',
    date: '2026-05-28',
    topic: '주요 기업 주가 체크',
    badge: '투자루틴',
    question: '매일 어떤 종목을 봐야 해? NVDA 빅테크 삼성전자',
    answerHtml: `<p>대표주의 흐름이 오늘 시장의 신호입니다. 매일 아침 다음 기업들의 방향을 확인합니다.</p>
<table class="tbl">
<tr><th>기업</th><th>역할</th><th>보는 이유</th></tr>
<tr><td><strong>NVDA</strong></td><td>AI 온도계</td><td>기술주 흐름의 출발점. NVDA가 급락하면 기술주 전체 위험 신호</td></tr>
<tr><td>AAPL · MSFT · AMZN · GOOGL · TSLA</td><td>빅테크 5총사</td><td>나스닥 방향과 거의 동일. 5개 중 3개 이상 하락이면 기술주 약세</td></tr>
<tr><td>JPM</td><td>금융·금리 민감</td><td>금리 상승 수혜주. JPM 강세 = 금리 상승 기대감</td></tr>
<tr><td>WMT</td><td>소비 흐름</td><td>경기 방어주. WMT 강세 = 소비 방어적 흐름</td></tr>
<tr><td>삼성전자 · SK하이닉스</td><td>코스피 핵심</td><td>코스피 전체 방향. HBM·AI 수요와 직결</td></tr>
</table>
<div class="tip"><strong>핵심 원칙:</strong> 변동폭이 컸던 종목의 이유를 <strong>한 줄</strong>로 파악합니다. "왜 올랐나/내렸나" 이유 없이 주가만 보는 것은 소음 소비입니다.</div>`,
  },
  {
    id: 'ir4',
    date: '2026-05-28',
    topic: '매일 계획 기록',
    badge: '투자루틴',
    question: '오늘의 계획은 어떻게 기록해?',
    answerHtml: `<p>짧은 한 줄이 하루를, 하루가 돈을 지킵니다. 매일 아침 <strong>오늘의 계획</strong>을 한 줄로 기록하십시오.</p>
<h4>아침 — 계획 한 줄</h4>
<ul>
<li>"오늘은 매수하지 않는다"</li>
<li>"○○ 종목 흐름 관찰만 한다"</li>
<li>"현금 비중 유지"</li>
</ul>
<h4>장 마감 후 — 마무리 기록</h4>
<ul>
<li>"오늘 잘 참았다" 또는 "감정이 흔들렸다"</li>
<li>실제 매매가 있었다면 <strong>이유와 감정 상태</strong> 메모</li>
</ul>
<div class="note">기록의 목적은 반성이 아닙니다. <strong>패턴을 발견</strong>하는 것입니다. "나는 급락 뉴스가 나오면 충동 매도한다"는 패턴을 알아야 다음에 막을 수 있습니다.</div>`,
  },
  {
    id: 'ir5',
    date: '2026-05-28',
    topic: '주간 포트폴리오 구조 점검',
    badge: '투자루틴',
    question: '매주 포트폴리오 구조 점검 어떻게 해?',
    answerHtml: `<p>수익률이 아니라 <strong>구조</strong>를 보십시오. 이번 주 수익이 우연인가, 전략의 힘인가를 판단하는 것이 핵심입니다.</p>
<h4>3가지 점검 항목</h4>
<table class="tbl">
<tr><th>항목</th><th>확인 내용</th><th>주의 신호</th></tr>
<tr><td>수익률 원인</td><td>"이번 주 수익률이 우연인가, 구조의 힘인가?"</td><td class="o">운이었다면 전략 재점검</td></tr>
<tr><td>비중 쏠림</td><td>보유 종목별 비중이 계획 대비 과도하게 쏠린 곳</td><td class="r">특정 종목 20% 초과 시 리밸런싱 검토</td></tr>
<tr><td>현금 비중</td><td>목표 현금 비중 범위 안에 있는가</td><td class="r">현금 너무 적으면 기회비용 손실</td></tr>
</table>
<div class="tip"><strong>핵심 질문:</strong> "나는 지금 전략을 실행하고 있는가, 아니면 시장에 끌려다니고 있는가?"</div>`,
  },
  {
    id: 'ir6',
    date: '2026-05-28',
    topic: '매매 이유 기록 주간',
    badge: '투자루틴',
    question: '매매 이유는 왜 기록해야 해?',
    answerHtml: `<p>이유가 반복되면 전략이 되고, 전략이 쌓이면 수익률을 지킵니다.</p>
<h4>매주 기록할 항목</h4>
<ul>
<li>이번 주 <strong>매수한 종목</strong> — 이유 한 줄 기록</li>
<li>이번 주 <strong>매도한 종목</strong> — 이유 한 줄 기록</li>
<li>잘한 판단 vs <strong>감정에 휘둘린 판단</strong> 구분</li>
</ul>
<h4>기록 예시</h4>
<div class="note">
"삼성전자 매도 후 주가 상승 → 매도 타이밍이 조급함에서 비롯됨"<br>
"현금 유지 → 금리 불확실성 대응 성공 → 원칙 준수"
</div>
<h4>다음 주 계획</h4>
<ul>
<li>반복된 실수 패턴이 있다면 → 다음 주 주의사항 한 줄 기록</li>
<li>관심 종목 중 다음 주 점검할 항목 정리</li>
<li>"이유 없이 사고 싶다"는 충동이 있다면 → <strong>1주 대기 원칙</strong></li>
</ul>`,
  },
  {
    id: 'ir7',
    date: '2026-05-28',
    topic: '거시 지표 월간 확인',
    badge: '투자루틴',
    question: '매월 거시 지표 어떻게 봐야 해? 환율 코스피',
    answerHtml: `<p>숫자 하나가 아니라 <strong>방향과 속도</strong>를 읽는 것이 핵심입니다.</p>
<h4>3가지 거시 지표</h4>
<table class="tbl">
<tr><th>지표</th><th>전월 대비 확인 포인트</th><th>의미</th></tr>
<tr><td>미 10년물 금리</td><td>방향과 변화폭</td><td>금리 3.8→4.3%: 단순 수치가 아닌 <strong>기류 변화</strong></td></tr>
<tr><td>원/달러 환율</td><td>상승/하락 방향</td><td>환율 1,350→1,400: 외국인 이탈 신호 → 코스피 하락 압력</td></tr>
<tr><td>코스피</td><td>단순 반등 vs 새로운 추세</td><td>반등의 이유가 있는가, 일시적인가</td></tr>
</table>
<div class="warn"><strong>함정:</strong> 수치 자체가 아니라 "왜 바뀌었는가"가 중요합니다. 금리가 올랐다면 인플레이션 우려인지, 경기 회복인지에 따라 의미가 다릅니다.</div>`,
  },
  {
    id: 'ir8',
    date: '2026-05-28',
    topic: '섹터 흐름 월간',
    badge: '투자루틴',
    question: '매월 섹터 흐름은 어떻게 파악해? 성장주 가치주',
    answerHtml: `<p>어떤 종목이 올랐는가보다 <strong>어떤 흐름이 만들어지는가</strong>를 봐야 합니다.</p>
<h4>3가지 확인 포인트</h4>
<ul>
<li><strong>강한 섹터 / 약한 섹터</strong> — 시장 관심이 어디로 이동하고 있는가</li>
<li><strong>성장주 vs 가치주</strong> — 어디로 돈이 움직이는가<br>
  금리 상승 구간 → 가치주 유리 / 금리 하락 구간 → 성장주 유리</li>
<li><strong>내 포트폴리오</strong>가 이 흐름과 맞닿아 있는가</li>
</ul>
<div class="note">섹터 흐름은 경제 사이클과 연결됩니다. 경기 확장기엔 기술·소비주, 경기 둔화기엔 필수소비·헬스케어·배당주가 강세를 보이는 경향이 있습니다.</div>`,
  },
  {
    id: 'ir9',
    date: '2026-05-28',
    topic: '분기 실적 점검 — 매출 영업이익 FCF ROE',
    badge: '투자루틴',
    question: '분기 실적 점검은 어떻게 해? 매출 영업이익 FCF ROE',
    answerHtml: `<p>매 분기 이 4가지를 기록하면 <strong>기업 점검표</strong>가 완성됩니다.</p>
<table class="tbl">
<tr><th>지표</th><th>핵심 확인</th><th>경고 신호</th></tr>
<tr><td><strong>매출</strong></td><td>전분기 대비 방향 + 이유</td><td class="o">매출 ↑이지만 이유가 가격 인상뿐이면 주의</td></tr>
<tr><td><strong>영업이익</strong></td><td>영업이익률 방향</td><td class="r">매출↑ + 영업이익↓ = 비용 문제</td></tr>
<tr><td><strong>FCF</strong></td><td>플러스 / 마이너스</td><td class="r">순이익 1,000억 + FCF 마이너스 = 현금이 묶임</td></tr>
<tr><td><strong>ROE</strong></td><td>전분기 대비 방향</td><td class="r">ROE 지속 하락 = 경쟁력 약화 경고</td></tr>
</table>
<h4>패턴 해석</h4>
<table class="tbl">
<tr><th>패턴</th><th>의미</th></tr>
<tr><td>매출 ↑ + 영업이익 ↓</td><td class="r">비용 구조 문제 → 손익계산서 직접 확인</td></tr>
<tr><td>매출 ↓ + 영업이익 ↑</td><td class="g">구조 개선 중 — 비용 효율화 성공</td></tr>
<tr><td>FCF 마이너스 (투자 확대)</td><td class="o">신규 투자 확대인가, 운영 문제인가 구분 필요</td></tr>
</table>
<div class="tip"><strong>마무리 두 가지 질문:</strong> "실적이 개선됐는가?" + "전망이 유지되는가?" 이 두 질문으로 분기 점검을 마무리합니다.</div>`,
  },
  {
    id: 'ir10',
    date: '2026-05-28',
    topic: 'FCF 잉여현금흐름',
    badge: '투자루틴',
    question: 'FCF가 뭐야? 잉여현금흐름 왜 중요해?',
    answerHtml: `<p><strong>FCF(Free Cash Flow, 잉여현금흐름)</strong> — 기업이 영업 활동과 투자 후 <strong>실제로 손에 남는 현금</strong>입니다.</p>
<div class="warn">이익이 있어도 현금이 빠지면 기업은 숨이 찹니다. 순이익과 FCF는 다릅니다.</div>
<h4>왜 FCF가 중요한가</h4>
<table class="tbl">
<tr><th>상황</th><th>의미</th></tr>
<tr><td class="g">FCF 플러스 (+)</td><td>배당·자사주 매입·부채 상환 가능 — 주주 친화적</td></tr>
<tr><td class="r">FCF 마이너스 (−)</td><td>외부 자금 조달 필요 → 부채 증가 위험</td></tr>
<tr><td class="o">FCF 마이너스 (투자 확대)</td><td>신규 설비·R&D 투자 → 미래 성장 가능성 (단, 회수 여부 확인 필요)</td></tr>
</table>
<div class="note">순이익 1,000억 + FCF 마이너스 = 현금이 설비·재고에 묶인 상태. 장부상 이익이 실제 현금이 아닐 수 있습니다.</div>
<h4>분기 점검 체크리스트</h4>
<ul>
<li>FCF가 플러스인가 마이너스인가 확인</li>
<li>FCF 마이너스 시 → 신규 투자 확대인가, 운영 문제인가 구분</li>
<li>순이익과 FCF의 괴리가 크면 이유 파악</li>
</ul>`,
  },
  {
    id: 'ir11',
    date: '2026-05-28',
    topic: 'ROE 자기자본이익률',
    badge: '투자루틴',
    question: 'ROE가 뭐야? 자기자본이익률 어떻게 봐?',
    answerHtml: `<p><strong>ROE(Return on Equity, 자기자본이익률)</strong> — 주주가 맡긴 자본으로 기업이 얼마나 잘 버는가를 보여줍니다.</p>
<div class="note">ROE = 순이익 ÷ 자기자본 × 100%<br>ROE 15%라면 주주가 100원을 맡겼을 때 15원을 번다는 뜻입니다.</div>
<h4>ROE 분기 점검</h4>
<table class="tbl">
<tr><th>신호</th><th>의미</th></tr>
<tr><td class="g">ROE 유지 또는 상승</td><td>자본 효율성 양호 — 경쟁력 유지</td></tr>
<tr><td class="r">ROE 지속 하락</td><td>경쟁력 약화 경고 신호 → 매도 검토</td></tr>
<tr><td class="o">ROE 일시 하락</td><td>일회성 비용인지, 구조적 문제인지 확인 필요</td></tr>
</table>
<h4>워런 버핏이 ROE를 중시하는 이유</h4>
<p>버핏은 <strong>"10년 연속 ROE 15% 이상"</strong> 기업을 선호합니다. 꾸준한 ROE는 경쟁 우위(해자)의 증거이기 때문입니다.</p>
<div class="tip"><strong>결론:</strong> ROE가 꾸준히 높고 유지된다면 → 좋은 기업 신호. ROE가 빠르게 떨어진다면 → 보유 이유를 다시 점검하세요.</div>`,
  },
  {
    id: 'ir12',
    date: '2026-05-28',
    topic: '심리 점검 — FOMO 앵커링 매수 전 질문',
    badge: '심리점검',
    question: '투자 심리 점검 어떻게 해? FOMO 앵커링',
    answerHtml: `<p>투자는 마음의 싸움입니다. 감정이 아닌 <strong>원칙으로 스스로를 붙잡아야</strong> 합니다.</p>
<h4>매수 전 반드시 물어볼 질문</h4>
<div class="warn">
"왜 지금, 왜 이 가격에 사려는가?"<br>
"무엇이 변하거나 틀리면 바로 팔 것인가?"
</div>
<h4>FOMO (Fear of Missing Out) 차단</h4>
<ul>
<li>남들의 수익보다 <strong>나의 원칙</strong>이 중요합니다</li>
<li>목표 투자금·현금 비율·산업 비중·개별 종목 한도를 미리 설정</li>
<li>계획이 있으면 조급함은 줄어듭니다</li>
</ul>
<h4>앵커 제거 (Anchoring Bias)</h4>
<ul>
<li>과거의 매수 단가(본전)를 잊고, <strong>현재의 가치와 미래 현금흐름</strong>으로 재평가</li>
<li>"본전"이라는 단어를 마음에서 지우는 순간, 비로소 현실이 보입니다</li>
</ul>
<h4>반대 근거 찾기</h4>
<ul>
<li>확신보다 의심이 투자를 지킵니다</li>
<li>"내 생각보다 논리를 무너뜨릴 데이터는 무엇인가?" — 항상 반대 근거를 먼저 찾으십시오</li>
</ul>`,
  },
  {
    id: 'ir13',
    date: '2026-05-28',
    topic: '매도 규칙 소유 감정 손실 대응',
    badge: '심리점검',
    question: '매도 규칙은 뭐야? 언제 팔아야 해?',
    answerHtml: `<p>감정이 아니라 <strong>근거로 행동</strong>하십시오.</p>
<h4>매도 전 반드시 물어볼 질문</h4>
<div class="warn">
"나는 왜 팔려고 하는가?"<br>
"지금 처음 투자한다면 이 가격에 살까?"
</div>
<h4>소유 감정 억제</h4>
<ul>
<li>보유의 이유가 감정이라면, 그것은 투자보다 <strong>집착</strong>에 가깝습니다</li>
<li>좋은 기업이 반드시 좋은 투자로 이어지는 것은 아닙니다</li>
<li>"이 주식을 여전히 들고 있을 이유가 있는가?" — 정기적으로 물어보십시오</li>
</ul>
<h4>손실 대응</h4>
<ul>
<li>손실은 피할 수 없습니다. 다만 <strong>손실을 대하는 태도</strong>는 선택할 수 있습니다</li>
<li>잃은 자리에서 배울 것을 기록하고, 다음 투자 대상을 찾아두십시오</li>
<li>투자는 후회가 아니라 <strong>회복의 기술</strong>입니다</li>
</ul>
<div class="tip"><strong>원칙 행동 공식:</strong> 시장은 감정을 시험하지만, 원칙은 감정을 다스립니다. 판단과 행동의 기준을 늘 "계획"에 두십시오. 결과보다 과정이 더 중요합니다.</div>`,
  },
  {
    id: 'ir14',
    date: '2026-05-28',
    topic: '연간 자기평가 태도의 성장',
    badge: '투자루틴',
    question: '매년 투자 자기평가는 어떻게 해? 태도의 성장',
    answerHtml: `<p>일 년에 한 번은 계좌를 닫고 <strong>자신을 평가</strong>하십시오. 수익률을 보기 전에 올해의 나를 먼저 들여다보는 시간입니다.</p>
<h4>3단계 연간 자기평가</h4>
<h4>① 원칙 준수 점검</h4>
<ul>
<li>"올해 세운 투자 원칙을 실제로 지켰는가?"</li>
<li>"급락장에서 공포를 이기고 매수했는가, 뉴스에 흔들려 매도했는가?"</li>
<li>지킨 하루는 <strong>신념</strong>이 되고, 흔들린 하루는 <strong>교훈</strong>이 됩니다</li>
</ul>
<h4>② 판단을 흔든 요인 기록</h4>
<ul>
<li>친구 추천, 유튜브 낙관론, 추격 매수… 구체적으로 적기</li>
<li>그 순간의 감정(조급함·불안·탐욕)을 기록 → 내년의 실수를 막는 방패</li>
</ul>
<h4>③ 태도의 성장 점검</h4>
<table class="tbl">
<tr><th>작년</th><th>올해</th><th>평가</th></tr>
<tr><td>매일 수십 번 시세 확인</td><td>주 1회 포트폴리오 점검</td><td class="g">성장</td></tr>
<tr><td>손실에 분노</td><td>이유 분석 후 담담히 기록</td><td class="g">성장</td></tr>
</table>
<div class="note">수익보다 더 큰 자산은 바로 이 "태도의 변화"입니다. 한 해의 마지막 날, 그래프보다 일기를 먼저 여십시오. 그 안에 당신의 진짜 수익률이 적혀 있을 것입니다.</div>
<div class="tip"><strong>루틴의 힘:</strong> 루틴은 단조로워야 합니다. 단조로움이 마음을 단단하게 만듭니다. 버핏이 수십 년을 같은 방식으로 살았던 이유도 그것입니다. "Process becomes routine." — 과정이 습관이 되고, 습관이 결과를 만듭니다.</div>`,
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
