# 2026 FIFA 월드컵 대시보드 — 설계 문서

**날짜:** 2026-05-21  
**프로젝트:** daily-log (`src/components/WorldCup.tsx`)  
**폴더:** `C:/workspace/daily-log/fb/`

---

## 1. 개요

2026 FIFA 월드컵(USA·Canada·Mexico)을 즐기기 위한 대시보드.  
Claude Code CLI가 데이터를 수집·분석해 Cloudflare KV에 저장하면, daily-log React 앱이 메뉴 탭으로 표시한다.

**핵심 원칙:**
- 브라우저는 표시만 — API 호출·AI 분석은 모두 CLI가 담당
- 기존 Worker/KV 인프라 재활용
- "월드컵 업데이트해" 한 마디로 전체 갱신

---

## 2. 아키텍처

```
football-data.org API
        ↓
fb/worldcup.py  ←── Claude Code CLI 실행 ("월드컵 업데이트해")
        ↓  (데이터 수집 + 예측/관전포인트 생성)
POST /worldcup/update  (Worker 엔드포인트, API 키 인증)
        ↓
Cloudflare KV  key: "worldcup_data"
        ↑
GET /worldcup  (React가 마운트 시 fetch)
        ↑
WorldCup.tsx  (daily-log 사이드바 메뉴)
```

### 2.1 데이터 갱신 주기
- 조별리그 기간: 경기 있는 날 CLI로 수동 실행
- 경기 당일 실시간 스코어: football-data.org API에서 직접 fetch (React → Worker 프록시)
- 토너먼트 진출 확정 후: 브래킷 업데이트를 위해 재실행

---

## 3. KV 데이터 구조

**KV key:** `worldcup_data`

```typescript
interface WorldCupData {
  updatedAt: string;          // ISO 8601
  stage: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final';
  todayMatches: Match[];      // 오늘 경기 (실시간 스코어 포함)
  upcomingMatches: Match[];   // 향후 3일 경기
  groups: Record<string, GroupData>;  // "A" ~ "L"
  bracket: BracketData;
  hotPlayers: HotPlayer[];    // 대회 득점·도움 TOP 6
}

interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  utcDate: string;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED';
  score: { home: number | null; away: number | null };
  prediction: {
    homeWin: number;       // 승률 %
    draw: number;
    awayWin: number;
    predictedScore: string;    // "2-1"
    watchPoints: string;       // Claude Code 생성 텍스트
    keyPlayer: string;
    h2hSummary: string;        // 최근 H2H 요약
  };
}

interface Team {
  name: string;    // 한국어 팀명
  code: string;    // "BRA"
  flag: string;    // "🇧🇷"
  fifaRank: number;
}

interface GroupData {
  name: string;   // "A조"
  standings: Standing[];
}

interface Standing {
  rank: number;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

interface BracketData {
  r32: BracketMatch[];
  r16: BracketMatch[];
  qf: BracketMatch[];
  sf: BracketMatch[];
  final: BracketMatch | null;
}

interface BracketMatch {
  slot: string;       // "R16-1"
  homeTeam: Team | null;
  awayTeam: Team | null;
  score: { home: number | null; away: number | null };
  winner: Team | null;
}

interface HotPlayer {
  name: string;
  team: Team;
  goals: number;
  assists: number;
  minutesPlayed: number;
}
```

---

## 4. CLI 스크립트 (`fb/worldcup.py`)

### 실행 방법
```
"월드컵 업데이트해"
→ Python fb/worldcup.py 실행
```

### 처리 순서
1. `football-data.org` API에서 다음 데이터 fetch:
   - 오늘·향후 3일 경기 일정 (`/competitions/WC/matches`)
   - 조별 순위 (`/competitions/WC/standings`)
   - 득점 순위 (`/competitions/WC/scorers`)
2. 수집된 데이터를 기반으로 Claude Code 어시스턴트(이 채팅)가 직접 분석 생성:
   - 최근 양 팀 폼 (최근 5경기 결과)
   - H2H 전적 요약
   - 예측 스코어 및 승률 (FIFA 랭킹 + 최근 폼 + H2H 가중 계산)
   - 관전포인트 텍스트 (한국어, 2~3문장) — Claude Code가 직접 작성
   - 주목 선수
3. JSON 직렬화 → `POST /worldcup/update` (Worker)

### 환경변수
```
FOOTBALL_DATA_API_KEY=...   # football-data.org API 키 (무료 티어: 분당 10req)
WORKER_SECRET=...            # Worker POST 엔드포인트 인증 (wrangler.toml에 기존 CRON_SECRET 재활용 또는 신규 추가)
```

---

## 5. Worker 엔드포인트 (`worker/src/index.ts`)

### 추가 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/worldcup` | KV에서 worldcup_data 반환 |
| POST | `/worldcup/update` | worldcup_data KV 저장 (API 키 필요) |
| GET | `/worldcup/live` | football-data.org에서 실시간 스코어만 proxy |

`/worldcup/live`는 React가 경기 당일 30초마다 폴링해 스코어를 갱신한다.  
예측·관전포인트 등 무거운 데이터는 KV에서만 읽는다.

---

## 6. UI 컴포넌트 (`src/components/WorldCup.tsx`)

### 페이지 레이아웃 (C형 — 예측 분석형)

```
┌─────────────────────────────────────┐
│ ⚽ 2026 FIFA 월드컵   [단계] [D+일수] │  ← 헤더
├─────────────────────────────────────┤
│ TODAY · 6월 15일 오늘 경기 N경기      │  ← 섹션 레이블
│ ┌───────────────────────────────┐   │
│ │ 🇧🇷 브라질  2·1  아르헨티나 🇦🇷│   │  ← 경기 카드
│ │ ● LIVE 67'                    │   │    (진행중: 실시간 스코어)
│ │ 브52% 무24% 아24%  예측 2-1   │   │    (예정: 킥오프 시간)
│ │ ⚡ 관전포인트: ...             │   │
│ │ 🔑 주목: Vinícius Jr          │   │
│ └───────────────────────────────┘   │
│ (경기 카드 반복...)                   │
├─────────────────────────────────────┤
│ 조별 순위  [A][B][C]...[L]           │  ← 탭 전환
│ ┌───────────────────────────────┐   │
│ │ # 팀         승 무 패 득실 점  │   │
│ │ 1 🇧🇷 브라질  2  0  0  +5  6  │   │
│ └───────────────────────────────┘   │
├─────────────────────────────────────┤
│ ⚡ 핫 플레이어 (3열 그리드)           │  ← 득점·도움 TOP
└─────────────────────────────────────┘
```

### 상태 관리
```typescript
const [data, setData] = useState<WorldCupData | null>(null);
const [liveScores, setLiveScores] = useState<Record<string, Score>>({});
const [selectedGroup, setSelectedGroup] = useState('A');
const [loading, setLoading] = useState(true);
```

### 실시간 스코어 폴링
- 오늘 경기 중 `status === 'LIVE'`인 경기가 있으면 30초마다 `/worldcup/live` 호출
- 컴포넌트 언마운트 시 `clearInterval`

---

## 7. 사이드바 메뉴 추가 (`src/components/Sidebar.tsx`)

- 아이콘: `sports_soccer` (Material Icons)
- 레이블: `월드컵`
- 페이지 ID: `'worldcup'`
- `App.tsx`의 `renderPage()`에 `<WorldCup />` 케이스 추가

---

## 8. 에러 처리

| 상황 | 처리 |
|------|------|
| KV 데이터 없음 | "아직 데이터가 없습니다. '월드컵 업데이트해' 실행해주세요." 안내 |
| API fetch 실패 | 기존 KV 데이터 유지, toast "업데이트 실패" |
| 실시간 스코어 실패 | 폴링 중단, KV 스코어 유지 |
| football-data.org 무료 한도 초과 | 스크립트에서 에러 출력, KV 미갱신 |

---

## 9. 파일 목록

| 파일 | 역할 |
|------|------|
| `fb/worldcup.py` | CLI 스크립트 (데이터 수집·분석·KV 저장) |
| `fb/.env.example` | 필요한 환경변수 목록 |
| `src/components/WorldCup.tsx` | React 대시보드 컴포넌트 |
| `worker/src/index.ts` | `/worldcup`, `/worldcup/update`, `/worldcup/live` 추가 |
| `src/App.tsx` | `renderPage()`에 worldcup 케이스 추가 |
| `src/components/Sidebar.tsx` | 메뉴 항목 추가 |

---

## 10. 구현 순서

1. Worker 엔드포인트 추가 + KV 바인딩 확인
2. `fb/worldcup.py` CLI 스크립트 작성
3. `WorldCup.tsx` UI 컴포넌트 구현
4. Sidebar + App.tsx 연결
5. Worker 배포 → CLI 테스트 실행 → 브라우저 확인
