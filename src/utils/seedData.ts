import type { Account, OtherAsset } from '../types';

const STORAGE_KEY = 'asset_accounts';
const SEED_LOADED_KEY = 'asset_seed_loaded';
const OTHER_ASSETS_KEY = 'asset_others';
const OTHER_SEED_KEY = 'asset_other_seed_loaded';

const SEED_ACCOUNTS: Account[] = [
  {
    id: "jy-funsu", owner: "wife", ownerName: "지윤", institution: "미래에셋증권", accountType: "일반", alias: "펀슈",
    holdings: [
      { id: "jy-f-01", name: "TIGER 미국나스닥100", ticker: "133690", market: "KR", avgPrice: 149321, quantity: 107 },
      { id: "jy-f-02", name: "TIGER 단기채권액티브", ticker: "272580", market: "KR", avgPrice: 214, quantity: 79 },
      { id: "jy-f-03", name: "KODEX 미국10년국채선물", ticker: "308620", market: "KR", avgPrice: 12367, quantity: 510 },
      { id: "jy-f-04", name: "KODEX 미국AI전력핵심인프라", ticker: "487230", market: "KR", avgPrice: 20401, quantity: 193 },
      { id: "jy-f-05", name: "RISE 미국테크100데일리고정커버드콜", ticker: "491620", market: "KR", avgPrice: 10684, quantity: 829 },
      { id: "jy-f-06", name: "KODEX 코스닥150", ticker: "229200", market: "KR", avgPrice: 14354, quantity: 106 },
      { id: "jy-f-07", name: "KODEX 200타겟위클리커버드콜", ticker: "498400", market: "KR", avgPrice: 16241, quantity: 577 },
      { id: "jy-f-08", name: "KODEX 200타겟위클리커버드콜(2)", ticker: "498400", market: "KR", avgPrice: 15229, quantity: 11 },
    ],
  },
  {
    id: "jy-mirae-retire", owner: "wife", ownerName: "지윤", institution: "미래에셋증권", accountType: "퇴직연금", alias: "미래퇴직",
    holdings: [
      { id: "jy-mr-01", name: "KODEX 미국S&P500데일리커버드콜OTM", ticker: "0005A0", market: "KR", avgPrice: 9693, quantity: 5 },
      { id: "jy-mr-02", name: "SOL 팔란티어커버드콜OTM채권혼합", ticker: "0040Y0", market: "KR", avgPrice: 10203, quantity: 101 },
      { id: "jy-mr-03", name: "TIGER 단기채권액티브", ticker: "272580", market: "KR", avgPrice: 56140, quantity: 333 },
      { id: "jy-mr-04", name: "ACE 미국S&P500", ticker: "360200", market: "KR", avgPrice: 22824, quantity: 344 },
      { id: "jy-mr-05", name: "ACE 엔비디아채권혼합", ticker: "448540", market: "KR", avgPrice: 23682, quantity: 99 },
      { id: "jy-mr-06", name: "TIGER 미국30년국채스트립액티브(합성H)", ticker: "458250", market: "KR", avgPrice: 45855, quantity: 35 },
      { id: "jy-mr-07", name: "TIGER 은행고배당플러스TOP10", ticker: "466940", market: "KR", avgPrice: 15567, quantity: 57 },
    ],
  },
  {
    id: "jy-isa", owner: "wife", ownerName: "지윤", institution: "미래에셋증권", accountType: "ISA", alias: "ISA",
    holdings: [],
  },
  {
    id: "jy-hantu", owner: "wife", ownerName: "지윤", institution: "한국투자증권", accountType: "연금저축", alias: "연금한투",
    holdings: [
      { id: "jy-ht-01", name: "ACE KRX금현물", ticker: "411060", market: "KR", avgPrice: 20838, quantity: 90 },
      { id: "jy-ht-02", name: "TIGER KRX금현물", ticker: "0072R0", market: "KR", avgPrice: 12345, quantity: 343 },
      { id: "jy-ht-03", name: "KODEX 주주환원고배당주", ticker: "0153K0", market: "KR", avgPrice: 10255, quantity: 6 },
      { id: "jy-ht-04", name: "SOL 배당성향탑픽액티브", ticker: "152", market: "KR", avgPrice: 10483, quantity: 3 },
      { id: "jy-ht-05", name: "TIGER 미국채10년선물", ticker: "305080", market: "KR", avgPrice: 12899, quantity: 153 },
      { id: "jy-ht-06", name: "TIGER 단기채권액티브", ticker: "272580", market: "KR", avgPrice: 56190, quantity: 150 },
      { id: "jy-ht-07", name: "KODEX 200타겟위클리커버드콜", ticker: "498400", market: "KR", avgPrice: 16945, quantity: 100 },
      { id: "jy-ht-08", name: "SOL 미국30년국채커버드콜(합성)", ticker: "473330", market: "KR", avgPrice: 9205, quantity: 3 },
    ],
  },
  {
    id: "jy-kb-retire", owner: "wife", ownerName: "지윤", institution: "KB증권", accountType: "퇴직연금", alias: "KB퇴직",
    holdings: [
      { id: "jy-kb-01", name: "KODEX 인도Nifty50", ticker: "453810", market: "KR", avgPrice: 13772, quantity: 260 },
      { id: "jy-kb-02", name: "KODEX 테슬라커버드콜채권혼합액티브", ticker: "475080", market: "KR", avgPrice: 9211, quantity: 6 },
      { id: "jy-kb-03", name: "KODEX 미국30년국채타겟커버드콜(합성H)", ticker: "481060", market: "KR", avgPrice: 10025, quantity: 104 },
      { id: "jy-kb-04", name: "SOL 팔란티어커버드콜OTM채권혼합", ticker: "0040Y0", market: "KR", avgPrice: 9974, quantity: 100 },
      { id: "jy-kb-05", name: "TIGER 단기채권액티브", ticker: "272580", market: "KR", avgPrice: 56112, quantity: 17 },
    ],
  },
  {
    id: "jy-dc", owner: "wife", ownerName: "지윤", institution: "미래에셋증권", accountType: "퇴직연금", alias: "기업DC",
    holdings: [
      { id: "jy-dc-01", name: "TIGER 미국나스닥100", ticker: "133690", market: "KR", avgPrice: 117189, quantity: 86 },
      { id: "jy-dc-02", name: "TIGER 미국필라델피아반도체나스닥", ticker: "381180", market: "KR", avgPrice: 18602, quantity: 103 },
      { id: "jy-dc-03", name: "TIME 글로벌AI인공지능액티브", ticker: "456600", market: "KR", avgPrice: 36545, quantity: 30 },
      { id: "jy-dc-04", name: "TIGER 글로벌AI전력인프라액티브", ticker: "491010", market: "KR", avgPrice: 20137, quantity: 7 },
      { id: "jy-dc-05", name: "TIGER 차이나휴머노이드로봇", ticker: "0053L0", market: "KR", avgPrice: 13775, quantity: 3 },
      { id: "jy-dc-06", name: "TIGER 코스닥150", ticker: "232080", market: "KR", avgPrice: 12755, quantity: 200 },
      { id: "jy-dc-07", name: "TIGER 테슬라채권혼합Fn", ticker: "447770", market: "KR", avgPrice: 13235, quantity: 355 },
      { id: "jy-dc-08", name: "ACE 엔비디아채권혼합", ticker: "448540", market: "KR", avgPrice: 21903, quantity: 207 },
      { id: "jy-dc-09", name: "ACE 미국30년국채액티브(H)", ticker: "453850", market: "KR", avgPrice: 8433, quantity: 866 },
      { id: "jy-dc-10", name: "ACE 미국나스닥100채권혼합액티브", ticker: "438100", market: "KR", avgPrice: 14611, quantity: 173 },
      { id: "jy-dc-11", name: "ACE 미국배당다우존스", ticker: "402970", market: "KR", avgPrice: 11339, quantity: 200 },
      { id: "jy-dc-12", name: "ACE KRX금현물", ticker: "411060", market: "KR", avgPrice: 29290, quantity: 11 },
      { id: "jy-dc-13", name: "KODEX 코스피100", ticker: "226490", market: "KR", avgPrice: 44350, quantity: 10 },
    ],
  },
  // ── 오빠 계좌 ──
  {
    id: "ob-funsu", owner: "husband", ownerName: "오빠", institution: "미래에셋증권", accountType: "일반", alias: "펀슈",
    holdings: [
      { id: "ob-f-01", name: "KODEX 코스닥150", ticker: "229200", market: "KR", avgPrice: 12838, quantity: 211 },
    ],
  },
  {
    id: "ob-mirae-retire", owner: "husband", ownerName: "오빠", institution: "미래에셋증권", accountType: "퇴직연금", alias: "미래퇴직",
    holdings: [
      { id: "ob-mr-01", name: "TIGER 단기채권액티브", ticker: "272580", market: "KR", avgPrice: 56190, quantity: 11 },
      { id: "ob-mr-02", name: "ACE 미국S&P500", ticker: "360200", market: "KR", avgPrice: 22365, quantity: 275 },
      { id: "ob-mr-03", name: "ACE 엔비디아채권혼합", ticker: "448540", market: "KR", avgPrice: 21773, quantity: 46 },
      { id: "ob-mr-04", name: "TIGER 은행고배당플러스TOP10", ticker: "466940", market: "KR", avgPrice: 20062, quantity: 132 },
      { id: "ob-mr-05", name: "TIGER CD1년금리액티브(합성)", ticker: "475630", market: "KR", avgPrice: 1045563, quantity: 2 },
      { id: "ob-mr-06", name: "KODEX 미국30년국채타겟커버드콜(합성H)", ticker: "481060", market: "KR", avgPrice: 9581, quantity: 40 },
      { id: "ob-mr-07", name: "KODEX 200타겟위클리커버드콜", ticker: "498400", market: "KR", avgPrice: 11828, quantity: 72 },
    ],
  },
  {
    id: "ob-isa", owner: "husband", ownerName: "오빠", institution: "미래에셋증권", accountType: "ISA", alias: "미래ISA",
    holdings: [
      { id: "ob-is-01", name: "ACE 미국S&P500", ticker: "360200", market: "KR", avgPrice: 21791, quantity: 164 },
      { id: "ob-is-02", name: "TIGER 은행고배당플러스TOP10", ticker: "466940", market: "KR", avgPrice: 18777, quantity: 59 },
      { id: "ob-is-03", name: "SOL 미국AI전력인프라", ticker: "486450", market: "KR", avgPrice: 21179, quantity: 7 },
    ],
  },
  {
    id: "ob-mirae-pension", owner: "husband", ownerName: "오빠", institution: "미래에셋증권", accountType: "연금저축", alias: "미래연금",
    holdings: [
      { id: "ob-mp-01", name: "KIWOOM 국고채10년", ticker: "148070", market: "KR", avgPrice: 109186, quantity: 21 },
      { id: "ob-mp-02", name: "TIGER KRX금현물", ticker: "0072R0", market: "KR", avgPrice: 11867, quantity: 211 },
      { id: "ob-mp-03", name: "PLUS 고배당주", ticker: "161510", market: "KR", avgPrice: 20241, quantity: 10 },
      { id: "ob-mp-04", name: "KODEX 코스닥150", ticker: "229200", market: "KR", avgPrice: 15019, quantity: 178 },
      { id: "ob-mp-05", name: "TIGER 단기채권액티브", ticker: "272580", market: "KR", avgPrice: 56135, quantity: 95 },
      { id: "ob-mp-06", name: "TIGER 미국채10년선물", ticker: "305080", market: "KR", avgPrice: 13357, quantity: 21 },
      { id: "ob-mp-07", name: "ACE 미국S&P500", ticker: "360200", market: "KR", avgPrice: 23726, quantity: 600 },
      { id: "ob-mp-08", name: "ACE KRX금현물", ticker: "411060", market: "KR", avgPrice: 20201, quantity: 143 },
      { id: "ob-mp-09", name: "ACE 미국30년국채액티브(H)", ticker: "453850", market: "KR", avgPrice: 7642, quantity: 16 },
      { id: "ob-mp-10", name: "TIGER 은행고배당플러스TOP10", ticker: "466940", market: "KR", avgPrice: 19805, quantity: 117 },
      { id: "ob-mp-11", name: "ACE 구글밸류체인액티브", ticker: "483340", market: "KR", avgPrice: 14650, quantity: 102 },
      { id: "ob-mp-12", name: "SOL 미국AI전력인프라", ticker: "486450", market: "KR", avgPrice: 21297, quantity: 76 },
      { id: "ob-mp-13", name: "KODEX 200타겟위클리커버드콜", ticker: "498400", market: "KR", avgPrice: 10979, quantity: 1035 },
    ],
  },
];

const SEED_VERSION = '2'; // bump to force re-seed

const SEED_OTHER_ASSETS: OtherAsset[] = [
  // 지윤
  { id: 'oa-02', owner: 'wife', name: '우리사주', amount: 12711825 },
  { id: 'oa-03', owner: 'wife', name: '퇴직연금DC', amount: 86946452 },
  { id: 'oa-04', owner: 'wife', name: '유진', amount: 6413000 },
  { id: 'oa-05', owner: 'wife', name: '키움', amount: 13574800 },
  { id: 'oa-06', owner: 'wife', name: '일드맥스', amount: 14396377 },
  { id: 'oa-07', owner: 'wife', name: '기타', amount: 3000000 },
  { id: 'oa-08', owner: 'wife', name: '미래해외', amount: 12804596 },
  { id: 'oa-09', owner: 'wife', name: '비트코인', amount: 28229940 },
  { id: 'oa-10', owner: 'wife', name: '기타증권', amount: 29042479 },
  { id: 'oa-11', owner: 'wife', name: '금현물', amount: 288355 },
  { id: 'oa-12', owner: 'wife', name: '금', amount: 14139563 },
  // 오빠
  { id: 'oa-14', owner: 'husband', name: '퇴직연금DC', amount: 63384271 },
  { id: 'oa-15', owner: 'husband', name: '일드맥스', amount: 11979001 },
];

export function loadSeedDataIfNeeded(): Account[] | null {
  if (localStorage.getItem(SEED_LOADED_KEY) === SEED_VERSION) return null;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ACCOUNTS));
  localStorage.setItem(SEED_LOADED_KEY, SEED_VERSION);
  return SEED_ACCOUNTS;
}

export function loadSeedOtherAssets(): OtherAsset[] | null {
  if (localStorage.getItem(OTHER_SEED_KEY) === '1') return null;
  const existing = localStorage.getItem(OTHER_ASSETS_KEY);
  if (existing) {
    const parsed = JSON.parse(existing);
    if (Array.isArray(parsed) && parsed.length > 0) return null;
  }
  localStorage.setItem(OTHER_ASSETS_KEY, JSON.stringify(SEED_OTHER_ASSETS));
  localStorage.setItem(OTHER_SEED_KEY, '1');
  return SEED_OTHER_ASSETS;
}
