"""
초기 dividend_analysis KV 데이터 seed 스크립트
실행: python3 scripts/seed-dividend-analysis.py

Cloudflare KV REST API를 직접 사용합니다.
환경변수 필요: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
"""
import json, os
import urllib.request, urllib.error

CLOUDFLARE_API_TOKEN = os.environ.get('CLOUDFLARE_API_TOKEN', '')
CLOUDFLARE_ACCOUNT_ID = os.environ.get('CLOUDFLARE_ACCOUNT_ID', '')
KV_NAMESPACE_ID = 'c6cd88ef715c479ca351563f21421e6e'

if not CLOUDFLARE_API_TOKEN or not CLOUDFLARE_ACCOUNT_ID:
    print('CLOUDFLARE_API_TOKEN과 CLOUDFLARE_ACCOUNT_ID 환경변수가 필요합니다')
    print('사용법: set CLOUDFLARE_API_TOKEN=... && set CLOUDFLARE_ACCOUNT_ID=... && python3 scripts/seed-dividend-analysis.py')
    exit(1)

INITIAL_DATA = {
    "updatedAt": "2026년 4월 12일",
    "holdingsAnalysis": [
        {
            "ticker": "498400",
            "name": "KODEX 200타겟위클리커버드콜",
            "totalQty": 1795,
            "riskLevel": "high",
            "summary": "최대 비중 집중, 3월 방어력 최하위(-13.25%), 오빠 미래연금 1,035주",
            "action": "비중 축소 + 방어형 분산"
        },
        {
            "ticker": "491620",
            "name": "RISE 미국테크100데일리고정커버드콜",
            "totalQty": 829,
            "riskLevel": "low",
            "summary": "3월 방어력 +1.8%, 나스닥100 기초, 성과 가장 균형적",
            "action": "유지"
        },
        {
            "ticker": "0040Y0",
            "name": "SOL 팔란티어커버드콜OTM채권혼합",
            "totalQty": 201,
            "riskLevel": "high",
            "summary": "팔란티어 단일종목 기초, 연 26% 분배율 원금 잠식 가능",
            "action": "494300으로 교체 검토"
        },
        {
            "ticker": "0005A0",
            "name": "KODEX 미국S&P500데일리커버드콜OTM",
            "totalQty": 53,
            "riskLevel": "low",
            "summary": "S&P500 지수 기초, OTM 방어형, 퇴직연금 적합",
            "action": "유지 또는 확대 가능"
        },
        {
            "ticker": "481060",
            "name": "KODEX 미국30년국채타겟커버드콜(합성H)",
            "totalQty": 144,
            "riskLevel": "medium",
            "summary": "금리인하 사이클 수혜 구조, 금리 반등 시 원금 리스크",
            "action": "금리 방향 모니터링"
        },
        {
            "ticker": "475080",
            "name": "KODEX 테슬라커버드콜채권혼합액티브",
            "totalQty": 6,
            "riskLevel": "high",
            "summary": "테슬라 단일종목 기초, 변동성 극단적, 소량 보유",
            "action": "추가 매수 중단"
        }
    ],
    "issues": [
        {
            "level": "red",
            "title": "498400 집중 리스크",
            "detail": "전체 커버드콜 중 최대 비중, 오빠 미래연금에만 1,035주 단독 집중"
        },
        {
            "level": "red",
            "title": "하락장 최취약 구조",
            "detail": "498400은 3월 방어력 -13.25%로 국내 CC 전체 최하위 (13위/13위)"
        },
        {
            "level": "yellow",
            "title": "단일종목 기초 리스크",
            "detail": "팔란티어(0040Y0), 테슬라(475080) — 개별주 급락 시 채권 혼합도 한계"
        },
        {
            "level": "yellow",
            "title": "과도한 분배율",
            "detail": "SOL 팔란티어 연 26%+ → 원금 잠식 패턴의 전형적 수준"
        },
        {
            "level": "yellow",
            "title": "성장형 미혼합",
            "detail": "커버드콜 집중, 커버드콜:성장ETF = 5:5 혼합 권장 대비 불균형"
        }
    ],
    "recommendations": [
        {
            "rank": 1,
            "ticker": "494300",
            "name": "KODEX 미국나스닥100데일리커버드콜OTM",
            "monthlyRate": 1.65,
            "annualYield": 19.8,
            "reason": "3월 방어력 전체 1위(+1.9%), 나스닥100 OTM 구조, 팔란티어 교체 1순위"
        },
        {
            "rank": 2,
            "ticker": "441640",
            "name": "KODEX 미국배당커버드콜액티브",
            "monthlyRate": 1.20,
            "annualYield": 14.4,
            "reason": "시총 1위(1.45조) 안정성, 15일 배당으로 월 2회 수령 구조 가능"
        },
        {
            "rank": 3,
            "ticker": "489030",
            "name": "PLUS 고배당주위클리커버드콜",
            "monthlyRate": 1.51,
            "annualYield": 18.1,
            "reason": "3월 방어력 -6.54%(국내 4위), 498400 대비 방어력 2배, 1년 44.2%"
        },
        {
            "rank": 4,
            "ticker": "472150",
            "name": "TIGER 배당커버드콜액티브",
            "monthlyRate": 2.05,
            "annualYield": 24.6,
            "reason": "국내CC 월배당 1위, 1년 수익률 95%, 상승장 공격형 포지션용"
        }
    ],
    "improvementPlan": "498400(1,795주) 집중 → 일부를 489030(방어형)으로 분산하여 하락장 대비 강화\n\n0040Y0 팔란티어(201주) → 494300(나스닥100 OTM)으로 교체 검토: 연배당률 유사하면서 방어력 전체 1위\n\n441640(15일 배당) + 498400/491620(월말 배당) 조합 구성 시 월 2회 배당 수령 가능\n\n475080 테슬라(6주) → 추가 매수 중단, 비중 유지만\n\n481060 국채CC(144주) → 금리인하 사이클 지속 시 유지, 금리 반등 조짐 시 비중 축소"
}

payload = json.dumps(INITIAL_DATA, ensure_ascii=False).encode('utf-8')
url = f'https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/{KV_NAMESPACE_ID}/values/dividend_analysis'

req = urllib.request.Request(
    url,
    data=payload,
    headers={
        'Authorization': f'Bearer {CLOUDFLARE_API_TOKEN}',
        'Content-Type': 'application/json',
    },
    method='PUT'
)

try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read())
        if result.get('success'):
            print('KV 저장 성공: dividend_analysis (초기 데이터 2026년 4월 12일)')
        else:
            print(f'실패: {result}')
except urllib.error.HTTPError as e:
    print(f'HTTP {e.code}: {e.read().decode("utf-8")[:300]}')
except Exception as e:
    print(f'오류: {e}')
