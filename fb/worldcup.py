"""
월드컵 데이터 수집 + KV 업데이트 CLI
사용법: python fb/worldcup.py
"""

import os
import json
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

WORKER_URL = "https://asset-dashboard-api.jilliankim200.workers.dev"
FOOTBALL_API_BASE = "https://api.football-data.org/v4"
WC_COMPETITION = "WC"

# .env 파일에서 환경변수 로드
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, val = line.partition("=")
                    os.environ.setdefault(key.strip(), val.strip())

def football_api(path: str) -> dict:
    api_key = os.environ.get("FOOTBALL_DATA_API_KEY", "")
    url = f"{FOOTBALL_API_BASE}{path}"
    req = urllib.request.Request(url, headers={"X-Auth-Token": api_key})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  API 오류 {e.code}: {path}", file=sys.stderr)
        return {}

def post_to_worker(data: dict) -> bool:
    payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{WORKER_URL}/worldcup/update",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            return result.get("ok", False)
    except Exception as e:
        print(f"  Worker 전송 실패: {e}", file=sys.stderr)
        return False

# KR 국가명 매핑 (주요 팀)
TEAM_NAMES_KR = {
    "Brazil": "브라질", "Argentina": "아르헨티나", "France": "프랑스",
    "England": "잉글랜드", "Germany": "독일", "Spain": "스페인",
    "Portugal": "포르투갈", "Netherlands": "네덜란드", "Belgium": "벨기에",
    "Uruguay": "우루과이", "Croatia": "크로아티아", "Denmark": "덴마크",
    "Senegal": "세네갈", "Morocco": "모로코", "Japan": "일본",
    "South Korea": "대한민국", "Australia": "호주", "USA": "미국",
    "Mexico": "멕시코", "Canada": "캐나다", "Ecuador": "에콰도르",
    "Colombia": "콜롬비아", "Chile": "칠레", "Peru": "페루",
    "Switzerland": "스위스", "Serbia": "세르비아", "Poland": "폴란드",
    "Ukraine": "우크라이나", "Turkey": "튀르키예", "Hungary": "헝가리",
    "Austria": "오스트리아", "Czech Republic": "체코", "Scotland": "스코틀랜드",
    "Italy": "이탈리아", "Saudi Arabia": "사우디아라비아", "Iran": "이란",
    "Nigeria": "나이지리아", "Ghana": "가나", "Egypt": "이집트",
    "Cameroon": "카메룬", "Tunisia": "튀니지", "Ivory Coast": "코트디부아르",
    "Mali": "말리", "Algeria": "알제리", "Congo DR": "콩고DR",
    "New Zealand": "뉴질랜드", "Qatar": "카타르", "Costa Rica": "코스타리카",
    "Panama": "파나마", "Honduras": "온두라스", "Bolivia": "볼리비아",
    "Venezuela": "베네수엘라", "Paraguay": "파라과이", "Slovakia": "슬로바키아",
    "Slovenia": "슬로베니아", "Albania": "알바니아", "Romania": "루마니아",
    "Bulgaria": "불가리아", "Greece": "그리스", "Norway": "노르웨이",
    "Sweden": "스웨덴", "Finland": "핀란드", "Ireland": "아일랜드",
    "Wales": "웨일스", "Israel": "이스라엘", "Russia": "러시아",
}

TEAM_FLAGS = {
    "Brazil": "🇧🇷", "Argentina": "🇦🇷", "France": "🇫🇷",
    "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Germany": "🇩🇪", "Spain": "🇪🇸",
    "Portugal": "🇵🇹", "Netherlands": "🇳🇱", "Belgium": "🇧🇪",
    "Uruguay": "🇺🇾", "Croatia": "🇭🇷", "Denmark": "🇩🇰",
    "Senegal": "🇸🇳", "Morocco": "🇲🇦", "Japan": "🇯🇵",
    "South Korea": "🇰🇷", "Australia": "🇦🇺", "USA": "🇺🇸",
    "Mexico": "🇲🇽", "Canada": "🇨🇦", "Ecuador": "🇪🇨",
    "Colombia": "🇨🇴", "Chile": "🇨🇱", "Peru": "🇵🇪",
    "Switzerland": "🇨🇭", "Serbia": "🇷🇸", "Poland": "🇵🇱",
    "Ukraine": "🇺🇦", "Turkey": "🇹🇷", "Italy": "🇮🇹",
    "Saudi Arabia": "🇸🇦", "Iran": "🇮🇷", "Nigeria": "🇳🇬",
    "Ghana": "🇬🇭", "Egypt": "🇪🇬", "Cameroon": "🇨🇲",
    "Costa Rica": "🇨🇷", "Panama": "🇵🇦",
}

def team_kr(name: str) -> str:
    return TEAM_NAMES_KR.get(name, name)

def team_flag(name: str) -> str:
    return TEAM_FLAGS.get(name, "🏳️")

def build_team(api_team: dict) -> dict:
    name = api_team.get("name", "")
    return {
        "name": team_kr(name),
        "code": api_team.get("tla", "???"),
        "flag": team_flag(name),
        "fifaRank": api_team.get("fifaRank", 0),
    }

def map_status(status: str) -> str:
    mapping = {
        "SCHEDULED": "SCHEDULED",
        "TIMED": "SCHEDULED",
        "IN_PLAY": "LIVE",
        "PAUSED": "LIVE",
        "FINISHED": "FINISHED",
        "AWARDED": "FINISHED",
    }
    return mapping.get(status, "SCHEDULED")

def build_match(m: dict) -> dict:
    score = m.get("score", {})
    ft = score.get("fullTime", {})
    ht = score.get("halfTime", {})
    current = ft if ft.get("home") is not None else ht
    return {
        "id": str(m.get("id", "")),
        "homeTeam": build_team(m.get("homeTeam", {})),
        "awayTeam": build_team(m.get("awayTeam", {})),
        "utcDate": m.get("utcDate", ""),
        "status": map_status(m.get("status", "")),
        "score": {
            "home": current.get("home"),
            "away": current.get("away"),
        },
        "prediction": {
            "homeWin": 0,
            "draw": 0,
            "awayWin": 0,
            "predictedScore": "?-?",
            "watchPoints": "",
            "keyPlayer": "",
            "h2hSummary": "",
        },
    }

def main():
    load_env()
    print("🌍 월드컵 데이터 수집 시작...")

    now_kst = datetime.now(timezone(timedelta(hours=9)))
    today_str = now_kst.strftime("%Y-%m-%d")

    # 경기 일정 가져오기 (향후 4일)
    print("  📅 경기 일정 조회 중...")
    date_from = today_str
    date_to = (now_kst + timedelta(days=3)).strftime("%Y-%m-%d")
    matches_resp = football_api(
        f"/competitions/{WC_COMPETITION}/matches?dateFrom={date_from}&dateTo={date_to}"
    )
    all_matches = matches_resp.get("matches", [])

    today_matches = []
    upcoming_matches = []
    for m in all_matches:
        match_date = m.get("utcDate", "")[:10]
        built = build_match(m)
        if match_date == today_str:
            today_matches.append(built)
        else:
            upcoming_matches.append(built)

    # 조별 순위
    print("  📊 조별 순위 조회 중...")
    standings_resp = football_api(f"/competitions/{WC_COMPETITION}/standings")
    groups: dict = {}
    for sg in standings_resp.get("standings", []):
        if sg.get("type") != "TOTAL":
            continue
        group_name = sg.get("group", "")  # e.g. "GROUP_A"
        letter = group_name.replace("GROUP_", "") if group_name else "?"
        label = f"{letter}조"
        rows = []
        for row in sg.get("table", []):
            rows.append({
                "rank": row.get("position", 0),
                "team": build_team(row.get("team", {})),
                "played": row.get("playedGames", 0),
                "won": row.get("won", 0),
                "drawn": row.get("draw", 0),
                "lost": row.get("lost", 0),
                "goalsFor": row.get("goalsFor", 0),
                "goalsAgainst": row.get("goalsAgainst", 0),
                "goalDifference": row.get("goalDifference", 0),
                "points": row.get("points", 0),
            })
        groups[letter] = {"name": label, "standings": rows}

    # 득점 순위 (TOP 6)
    print("  ⚽ 득점 순위 조회 중...")
    scorers_resp = football_api(f"/competitions/{WC_COMPETITION}/scorers?limit=6")
    hot_players = []
    for sc in scorers_resp.get("scorers", []):
        player = sc.get("player", {})
        team = sc.get("team", {})
        hot_players.append({
            "name": player.get("name", ""),
            "team": build_team(team),
            "goals": sc.get("goals", 0),
            "assists": sc.get("assists", 0),
            "minutesPlayed": sc.get("playedMatches", 0) * 90,
        })

    # 현재 단계 파악
    stage = "group"
    if standings_resp.get("competition", {}).get("currentSeason", {}).get("currentMatchday", 0) > 3:
        stage = "r16"

    data = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "stage": stage,
        "todayMatches": today_matches,
        "upcomingMatches": upcoming_matches,
        "groups": groups,
        "bracket": {"r32": [], "r16": [], "qf": [], "sf": [], "final": None},
        "hotPlayers": hot_players,
    }

    # JSON 저장 (백업)
    out_path = os.path.join(os.path.dirname(__file__), "worldcup_data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  💾 로컬 백업 저장: {out_path}")

    # Worker KV 업로드
    print("  📤 Worker KV 업로드 중...")
    ok = post_to_worker(data)
    if ok:
        print("✅ 월드컵 데이터 업데이트 완료!")
        print(f"   오늘 경기: {len(today_matches)}경기")
        print(f"   예정 경기: {len(upcoming_matches)}경기")
        print(f"   조별 순위: {len(groups)}개 조")
        print(f"   핫 플레이어: {len(hot_players)}명")
    else:
        print("❌ Worker 업로드 실패. worldcup_data.json 파일을 직접 확인하세요.")
        sys.exit(1)


if __name__ == "__main__":
    main()
