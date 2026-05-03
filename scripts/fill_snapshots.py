"""
누락된 스냅샷 날짜(2026-04-12 ~ 2026-04-14)를 채워넣는 스크립트.
규칙:
  - 주말/휴장일: 직전 거래일과 동일값 (assetChange=0, changeRate=0)
  - 거래일: Naver 종가 기준 포트폴리오 계산
"""
import json, re
from concurrent.futures import ThreadPoolExecutor
from urllib.request import urlopen, Request
from datetime import date

MISSING_DATES = ["2026-04-12", "2026-04-13", "2026-04-14"]
# 04-12=일, 04-13=월, 04-14=화
# 실제 한국 증시 휴장 여부는 Naver 데이터 유무로 판단

SCRIPT_DIR = "/c/workspace/daily-log/asset-dashboard/scripts"

def kv_get(key):
    path = f"{SCRIPT_DIR}/kv_{key}.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def fetch_naver_prices(ticker, count=20):
    url = f"https://fchart.stock.naver.com/sise.nhn?symbol={ticker}&timeframe=day&count={count}&requestType=0"
    try:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(req, timeout=10) as res:
            raw = res.read()
        try:
            text = raw.decode("euc-kr")
        except Exception:
            text = raw.decode("utf-8", errors="ignore")
        matches = re.findall(r'data="(\d{8})\|[^|]*\|[^|]*\|[^|]*\|([^|]+)\|', text)
        prices = {}
        for datestr, close in matches:
            d = f"{datestr[:4]}-{datestr[4:6]}-{datestr[6:8]}"
            v = int(close) if close.strip().lstrip('-').isdigit() else 0
            if v > 0:
                prices[d] = v
        return prices
    except Exception as e:
        print(f"  WARN {ticker}: {e}")
        return {}

def holding_value(h, prices_by_date, target_date):
    if h.get("isFund"):
        return h.get("amount", 0)
    ticker = h.get("ticker", "")
    price = prices_by_date.get(ticker, {}).get(target_date)
    if price:
        return price * h.get("quantity", 0)
    return h.get("avgPrice", 0) * h.get("quantity", 0)

def calc_total(accounts, other_assets, prices_by_date, target_date):
    total = 0
    wife = 0
    husband = 0
    for acc in accounts:
        acc_val = (acc.get("cash") or 0) + sum(holding_value(h, prices_by_date, target_date) for h in acc.get("holdings", []))
        total += acc_val
        if acc.get("owner") == "wife":
            wife += acc_val
        else:
            husband += acc_val
    for a in other_assets:
        v = a.get("amount", 0)
        total += v
        if a.get("owner") == "wife":
            wife += v
        else:
            husband += v
    return round(total), round(wife), round(husband)

def main():
    print("KV 데이터 로딩...")
    accounts = kv_get("accounts")
    other_assets = kv_get("otherAssets") or []
    snapshots = kv_get("snapshots")

    print(f"계좌: {len(accounts)}개, 기존 스냅샷: {len(snapshots)}개")

    # 티커 수집 (6자리만)
    tickers = list(set(
        h["ticker"] for a in accounts for h in a.get("holdings", [])
        if h.get("ticker") and re.match(r'^[0-9A-Z]{6}$', h["ticker"], re.I)
    ))
    print(f"티커 {len(tickers)}개 Naver 종가 조회 중...")

    prices_by_date = {}
    def fetch_one(ticker):
        return ticker, fetch_naver_prices(ticker, count=30)

    with ThreadPoolExecutor(max_workers=10) as ex:
        for ticker, prices in ex.map(fetch_one, tickers):
            prices_by_date[ticker] = prices

    # 기존 스냅샷을 날짜→데이터 dict으로
    snap_map = {s["date"]: s for s in snapshots}

    # 날짜 정렬 (오름차순)
    sorted_dates = sorted(snap_map.keys())

    for target in MISSING_DATES:
        if target in snap_map:
            print(f"{target}: 이미 존재, 건너뜀")
            continue

        # 직전 스냅샷 찾기
        prev_dates = [d for d in sorted_dates if d < target]
        if not prev_dates:
            print(f"{target}: 직전 스냅샷 없음, 건너뜀")
            continue
        prev_date = prev_dates[-1]
        prev_snap = snap_map[prev_date]

        # 해당 날짜에 Naver 종가 데이터가 있는지 확인
        has_price_data = any(
            target in prices_by_date.get(ticker, {})
            for ticker in tickers
        )

        if not has_price_data:
            # 휴장일 → 직전 스냅샷 복사
            new_snap = {
                "date": target,
                "totalAsset": prev_snap["totalAsset"],
                "wifeAsset": prev_snap["wifeAsset"],
                "husbandAsset": prev_snap["husbandAsset"],
                "assetChange": 0,
                "changeRate": 0.0,
            }
            print(f"{target}: 휴장일 → {prev_date} 값 복사 ({prev_snap['totalAsset']:,}원)")
        else:
            # 거래일 → 종가 기준 계산
            total, wife, husband = calc_total(accounts, other_assets, prices_by_date, target)
            change = total - prev_snap["totalAsset"]
            rate = round(change / prev_snap["totalAsset"] * 100, 4) if prev_snap["totalAsset"] else 0
            new_snap = {
                "date": target,
                "totalAsset": total,
                "wifeAsset": wife,
                "husbandAsset": husband,
                "assetChange": change,
                "changeRate": rate,
            }
            print(f"{target}: 거래일 → {total:,}원 (변동 {change:+,}원, {rate:+.2f}%)")

        snap_map[target] = new_snap
        sorted_dates = sorted(snap_map.keys())

    # 저장
    final = sorted(snap_map.values(), key=lambda s: s["date"], reverse=True)[:365]
    out_path = "/c/workspace/daily-log/asset-dashboard/scripts/snapshots_updated.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(final, f, ensure_ascii=False)
    print(f"\n저장 완료: {out_path} ({len(final)}개)")

    # 최신 5개 출력
    print("\n최신 스냅샷 5개:")
    for s in final[:5]:
        print(f"  {s['date']}: {s['totalAsset']:,}원 (변동 {s['assetChange']:+,}원)")

if __name__ == "__main__":
    main()
