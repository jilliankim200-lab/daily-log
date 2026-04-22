# Mobile Design System

> 본 시스템은 **모바일 기준 폰트 스케일을 baseline으로 통일**합니다.
> Desktop은 그보다 작은 사이즈를 자동 적용합니다 (`@media (max-width: 768px)` 기반 반전 매핑).
> 기준 페이지: **NewDashboard 티커바 + AccountReturn 카드** (가장 큰 자연스러운 폰트 페이지)

---

## 1. 폰트 스케일 (Type Scale)

### 1-1. 토큰 정의 (이미 존재 — `src/styles/design-tokens.css`)

| Token | Desktop | **Mobile (≤768px)** | 용도 |
|---|---|---|---|
| `--text-xs` | 12px | **15px** | 캡션, 메타정보, 보조 텍스트 |
| `--text-sm` | 13px | **16px** | 본문 기본, 리스트 항목, 라벨 |
| `--text-base` | 15px | **18px** | 카드 헤더, 강조 본문, 입력 필드 |
| `--text-lg` | 17px | **20px** | 섹션 제목 |
| `--text-xl` | 20px | **23px** | 카드 타이틀 (예: 잔액) |
| `--text-2xl` | 24px | **27px** | 페이지 서브타이틀 |
| `--text-3xl` | 28px | **31px** | 페이지 타이틀 |
| `--text-4xl` | 34px | **37px** | 디스플레이 (총 자산 등) |

### 1-2. 모바일 사용 가이드

| 용도 | 토큰 | 모바일 px | 폰트 굵기 |
|---|---|---|---|
| 페이지 타이틀 ("최적 가이드") | `--text-3xl` | 31 | 700 |
| 페이지 서브타이틀 (설명문) | `--text-base` | 18 | 400 |
| 섹션 헤더 ("계좌별 액션 플랜") | `--text-lg` | 20 | 700 |
| 카드 타이틀 (계좌명) | `--text-base` | 18 | 600 |
| 본문 / 리스트 항목 | `--text-sm` | 16 | 500 |
| 메타 (입금이력, 시간) | `--text-xs` | 15 | 400 |
| 강조 숫자 (총 자산) | `--text-4xl` | 37 | 700 |
| 카드 숫자 (잔액) | `--text-xl` | 23 | 700 |
| 인라인 숫자 (수익률 %) | `--text-base` | 18 | 700 |

---

## 2. 색상 (이미 정의됨)

### 2-1. 텍스트
| 토큰 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--text-primary` | `#191F28` | `#C0C2CC` | 본문, 제목 |
| `--text-secondary` | `#425870` | `#7C7F8E` | 보조 본문 |
| `--text-tertiary` | `#283849` | `#8b8c94` | 라벨, 캡션 |
| `--text-quaternary` | `#a0aab8` | `#3E404E` | 메타, 비활성 |
| `--text-disabled` | `#D1D6DB` | `#3C3E4A` | 비활성 |

### 2-2. 강조
| 토큰 | 용도 |
|---|---|
| `--accent-blue` | 주요 액션 |
| `--color-profit` | 수익 (한국식 빨강) |
| `--color-loss` | 손실 (파랑) |
| `--color-warning` | 경고 (노랑) |
| `--color-success` | 성공 (초록) |
| `--color-gold` | 강조 (★유지 등) |

### 2-3. 자산 분류
| 토큰 | 용도 |
|---|---|
| `--asset-stock` | 주식 |
| `--asset-bond` | 채권 |
| `--asset-covered` | 커버드콜 |
| `--asset-gold` | 금 |
| `--asset-other` | 기타 |

---

## 3. 간격 (Spacing)

| 토큰 | px | 용도 |
|---|---|---|
| `--space-1` | 4 | 인라인 간격 |
| `--space-2` | 8 | 컴포넌트 내부 |
| `--space-3` | 12 | 카드 패딩 (모바일) |
| `--space-4` | 16 | 카드 패딩 (기본) |
| `--space-5` | 20 | 카드 사이 |
| `--space-6` | 24 | 섹션 간격 |
| `--space-8` | 32 | 페이지 패딩 (데스크탑) |

**모바일 패딩 권장**: 페이지 16px, 카드 12~14px, 항목 8px

---

## 4. 모서리 (Radius)

| 토큰 | px | 용도 |
|---|---|---|
| `--radius-sm` | 8 | 버튼, 입력 |
| `--radius-md` | 12 | 작은 카드, 뱃지 |
| `--radius-lg` | 16 | 카드 |
| `--radius-xl` | 20 | 모달 |
| `--radius-full` | 9999 | pill, avatar |

---

## 5. 컴포넌트 레시피

### 5-1. 카드 (모바일)
```tsx
<div style={{
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 16,
  padding: '12px 14px',
}}>
  {/* 상단 메타 */}
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>라벨</span>
    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
      제목
    </span>
  </div>
  {/* 강조 값 */}
  <div className="toss-number" style={{
    fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)',
  }}>
    664,545,197원
  </div>
</div>
```

### 5-2. 리스트 항목 (모바일)
```tsx
<div style={{
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '12px 14px',
  borderBottom: '1px solid var(--border-primary)',
}}>
  <span style={{
    fontSize: 'var(--text-xs)', fontWeight: 700,
    padding: '2px 7px', borderRadius: 20,
    color: '#fff', background: 'var(--accent-blue)',
  }}>뱃지</span>
  <span style={{
    fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)',
    flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  }}>이름</span>
  <span className="toss-number" style={{
    fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-profit)',
  }}>+12.34%</span>
</div>
```

### 5-3. 버튼
```tsx
<button style={{
  padding: '8px 16px',
  borderRadius: 8,
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  background: 'var(--accent-blue)',
  color: 'var(--accent-blue-fg)',
  border: 'none',
  cursor: 'pointer',
}}>
  실행
</button>
```

### 5-4. 입력
```tsx
<input style={{
  padding: '8px 12px',
  borderRadius: 8,
  fontSize: 'var(--text-sm)',
  border: '1px solid var(--border-primary)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  height: 36,
  boxSizing: 'border-box',
}} />
```

### 5-5. Select
```tsx
<select style={{
  width: 110, height: 32, padding: '0 26px 0 10px',
  borderRadius: 8, border: '1px solid var(--border-primary)',
  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)', fontWeight: 600,
  appearance: 'none', WebkitAppearance: 'none',
  /* 커스텀 ▾ 화살표 */
  backgroundImage: `url("data:image/svg+xml;utf8,<svg .../>")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 9px center',
}}>
  ...
</select>
```

---

## 6. 적용 규칙 (Mandatory)

### 6-1. ✅ 권장 — 토큰 사용
```tsx
fontSize: 'var(--text-sm)'   // ✅ 모바일에서 자동 16px로 확대
```

### 6-2. ❌ 금지 — 하드코딩 px
```tsx
fontSize: 13                 // ❌ 모바일에서도 13px (작음)
fontSize: '12px'             // ❌ 동일
```

### 6-3. 🚫 예외
- 네이티브 컨트롤(`<input type="number">`) — 브라우저 기본 폰트 안 흔들리게 명시 가능
- 차트 라이브러리 props — 토큰 미지원 시 px 허용

---

## 7. 마이그레이션 체크리스트

현재 **하드코딩 폰트가 많은 파일** (수정 우선순위):

| 파일 | 하드코딩 fontSize 개수 | 우선도 |
|---|---:|---|
| `RebalancingGuide.tsx` | 58 | 🔴 높음 |
| `AccountReturn.tsx` | 38 | 🟠 중 (카드뷰는 완료) |
| `Holdings.tsx` | 32 | 🔴 높음 |
| `AssetChange.tsx` | 28 | 🟠 중 |
| `ChartPage.tsx` | 27 | 🟡 낮음 (차트 영역) |
| `CoupleAccounts.tsx` | 24 | 🟠 중 |
| `NewDashboard.tsx` | 21 | 🟠 중 |
| `Contribution.tsx` | 13 | 🟡 낮음 |
| `Rebalancing.tsx` | 10 | 🟡 낮음 |
| `RightSidebar.tsx` | 9 | 🟡 낮음 |
| `Dividend.tsx` | 9 | 🟡 낮음 |

### 7-1. 매핑 규칙
| 하드코딩 (px) | → 대체 토큰 |
|---|---|
| 9, 10, 11 | `var(--text-xs)` (12 → 모바일 15) |
| 12, 13, 14 | `var(--text-sm)` (13 → 모바일 16) |
| 15, 16 | `var(--text-base)` (15 → 모바일 18) |
| 17, 18 | `var(--text-lg)` (17 → 모바일 20) |
| 20 | `var(--text-xl)` (20 → 모바일 23) |
| 24 | `var(--text-2xl)` (24 → 모바일 27) |
| 28 | `var(--text-3xl)` (28 → 모바일 31) |
| 34+ | `var(--text-4xl)` (34 → 모바일 37) |

### 7-2. 검증 명령
```bash
# 하드코딩 fontSize 잔여 검색
grep -rE "fontSize: ['\"]?[0-9]+(px)?['\"]?[,}]" src/components/*.tsx
```

---

## 8. 다크/라이트 모드

`.dark` 클래스가 `<html>`에 적용되면 다크 토큰 자동 활성화. 컴포넌트 코드는 토큰만 사용하면 모드 전환 자동 대응.

---

## 9. 시각적 미리보기

브라우저에서 다음 파일 열기:
```
docs/mobile-design-preview.html
```

DevTools 모바일 뷰포트(375×667 권장)로 모든 컴포넌트 사이즈 한눈에 확인 가능.
