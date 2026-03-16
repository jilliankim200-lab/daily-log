import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Helper functions at top level to avoid duplication and scope issues
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

const parseNumber = (str: string): number => {
  if (!str) return 0;
  const cleaned = str.replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

// Helper function to construct Google Sheets URL
const getSheetsUrl = (gid: string, defaultUrl: string) => {
  const envUrl = Deno.env.get('GOOGLE_SHEETS_URL');
  if (!envUrl) return defaultUrl;

  try {
    const url = new URL(envUrl);
    // If it's a /pub URL
    if (url.pathname.includes('/pub')) {
      // Check if it already has search params
      const searchParams = new URLSearchParams(url.search);
      searchParams.set('gid', gid);
      searchParams.set('single', 'true');
      searchParams.set('output', 'csv');
      
      // Construct base URL without old params
      const baseUrl = `${url.origin}${url.pathname}`;
      return `${baseUrl}?${searchParams.toString()}`;
    }
    // If it's a regular /d/ URL, convert to export URL
    const idMatch = url.pathname.match(/\/d\/([^\/]+)/);
    if (idMatch) {
      return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
    }
    return defaultUrl;
  } catch (e) {
    console.log("Error parsing GOOGLE_SHEETS_URL:", e);
    return defaultUrl;
  }
};

/**
 * Common helper for fetching and parsing sheet data with consistent error handling and logging
 */
async function fetchSheetData(gid: string, defaultUrl: string, routeName: string) {
  const sheetsUrl = getSheetsUrl(gid, defaultUrl);
  console.log(`[${routeName}] Fetching data from: ${sheetsUrl}`);

  try {
    const response = await fetch(sheetsUrl);
    if (!response.ok) {
      const errorText = await response.text().catch(() => "No error body");
      console.error(`[${routeName}] Google Sheets API Error: ${response.status} - ${errorText}`);
      throw new Error(`Google Sheets API returned ${response.status}: ${errorText.substring(0, 100)}`);
    }

    const csvText = await response.text();
    const rows = csvText.trim().split(/\r?\n/).map(line => parseCSVLine(line));
    
    if (rows.length === 0 || (rows.length === 1 && !rows[0][0])) {
      console.warn(`[${routeName}] CSV returned empty data.`);
      throw new Error("No data found in the spreadsheet sheet.");
    }

    return { rows, url: sheetsUrl };
  } catch (error) {
    console.error(`[${routeName}] Fetch failed:`, error);
    throw error;
  }
}

// Health check endpoint
app.get("/make-server-cee564ea/health", (c) => {
  return c.json({ status: "ok" });
});

// Google Sheets data endpoint (Dashboard)
app.get("/make-server-cee564ea/sheets-data", async (c) => {
  try {
    const gid = '2027299266';
    const defaultUrl = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRl0ocjdF_bIA0hnYA_sbLbE5C8NbkWB0VUYJap5Mbb1q6MKMpcIQAWjOkwNBj-mmY9ycIaooJyZrDq/pub?gid=${gid}&single=true&output=csv`;
    
    const { rows } = await fetchSheetData(gid, defaultUrl, "Dashboard");
    const dataRows = rows.filter(row => row[0]?.trim());

    let monthlyAssetChange = 0;
    let yearlyAssetChange2025 = 0;
    let yearlyAssetChange2026 = 0;
    let monthlyAssetA1 = '';
    let monthlyAssetB1 = '';
    
    // Fetch Monthly Asset Change A1 and B1 values
    try {
      const monthlyGid = '1754277710';
      const monthlyUrl = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRl0ocjdF_bIA0hnYA_sbLbE5C8NbkWB0VUYJap5Mbb1q6MKMpcIQAWjOkwNBj-mmY9ycIaooJyZrDq/pub?gid=${monthlyGid}&single=true&output=csv`;
      const mResp = await fetch(monthlyUrl);
      if (mResp.ok) {
        const mText = await mResp.text();
        const mRows = mText.trim().split(/\r?\n/).map(line => parseCSVLine(line));
        monthlyAssetA1 = mRows[0]?.[0] || '';
        monthlyAssetB1 = mRows[0]?.[1] || '';
      }
    } catch (e) { console.log("Error fetching Monthly Asset A1/B1:", e); }

    if (rows.length > 1) monthlyAssetChange = parseNumber(rows[1][4] || '');
    if (rows.length > 2) yearlyAssetChange2025 = parseNumber(rows[2][4] || '');
    
    try {
      const assetStatusUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRl0ocjdF_bIA0hnYA_sbLbE5C8NbkWB0VUYJap5Mbb1q6MKMpcIQAWjOkwNBj-mmY9ycIaooJyZrDq/pub?gid=2110101642&single=true&output=csv';
      const assetStatusResponse = await fetch(assetStatusUrl);
      if (assetStatusResponse.ok) {
        const assetStatusCsvText = await assetStatusResponse.text();
        const assetStatusLines = assetStatusCsvText.trim().split(/\r?\n/);
        if (assetStatusLines.length > 23) yearlyAssetChange2026 = parseNumber(parseCSVLine(assetStatusLines[23])[14] || '');
      }
    } catch (e) { console.log(e); }

    const recentData = dataRows.slice(-14).reverse();
    const parsedData = recentData.map((row, index) => ({
      id: recentData.length - index,
      date: row[0] || '',
      dividend: parseNumber(row[1] || ''),
      totalAsset: parseNumber(row[2] || ''),
      assetChange: parseNumber(row[3] || ''),
      changeRate: parseNumber(row[2] || '') > 0 ? (parseNumber(row[3] || '') / parseNumber(row[2] || '')) * 100 : 0
    }));

    return c.json({
      dividend: parsedData[0]?.dividend || 0,
      totalAsset: parsedData[0]?.totalAsset || 0,
      assetChange: parsedData[0]?.assetChange || 0,
      monthlyAssetChange,
      monthlyAssetA1,
      monthlyAssetB1,
      yearlyAssetChange2025,
      yearlyAssetChange2026,
      lastUpdated: new Date().toISOString(),
      lastDate: parsedData[0]?.date || '',
      transactions: parsedData
    });
  } catch (error) { return c.json({ error: String(error) }, 500); }
});

app.get("/make-server-cee564ea/jiyoon-account-data", async (c) => {
  try {
    const accountType = c.req.query('account') || '펀슈';
    const gid = '788568754';
    const defaultUrl = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRl0ocjdF_bIA0hnYA_sbLbE5C8NbkWB0VUYJap5Mbb1q6MKMpcIQAWjOkwNBj-mmY9ycIaooJyZrDq/pub?gid=${gid}&single=true&output=csv`;
    
    const { rows: allRows } = await fetchSheetData(gid, defaultUrl, "JiyoonAccount");
    
    let targetRows: string[][] = [];
    if (accountType === '펀슈') targetRows = allRows.filter((row, idx) => idx > 0 && row[0]?.trim() === '펀슈');
    else if (accountType === '미래퇴직') targetRows = allRows.slice(13, 29);
    else if (accountType === 'ISA') targetRows = allRows.slice(30, 43);
    else if (accountType === '연금한투') targetRows = allRows.slice(44, 51);
    else if (accountType === 'KB퇴직') targetRows = allRows.slice(52, 60);

    const stockData = targetRows.map((row, index) => ({
      id: index + 1, tradeType: row[1] || '', stockType: row[2] || '', name: row[3] || '', ticker: row[4] || '',
      currentPrice: parseNumber(row[5] || ''), purchasePrice: parseNumber(row[6] || ''), quantity: parseNumber(row[7] || ''),
      totalPurchase: parseNumber(row[8] || ''), returnRate: parseNumber(row[9] || ''), returnAmount: parseNumber(row[10] || ''),
      evaluationAmount: parseNumber(row[11] || ''),
    }));
    return c.json({ account: accountType, stocks: stockData, lastUpdated: new Date().toISOString() });
  } catch (error) { return c.json({ error: String(error) }, 500); }
});

app.get("/make-server-cee564ea/oppa-account-data", async (c) => {
  try {
    const accountType = c.req.query('account') || '펀슈';
    const gid = '1435837014';
    const defaultUrl = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRl0ocjdF_bIA0hnYA_sbLbE5C8NbkWB0VUYJap5Mbb1q6MKMpcIQAWjOkwNBj-mmY9ycIaooJyZrDq/pub?gid=${gid}&single=true&output=csv`;
    
    const { rows: allRows } = await fetchSheetData(gid, defaultUrl, "OppaAccount");
    
    let targetRows: string[][] = [];
    if (accountType === '펀슈') targetRows = allRows.slice(1, 12);
    else if (accountType === '미래퇴직') targetRows = allRows.slice(14, 25);
    else if (accountType === '미래ISA') targetRows = allRows.slice(26, 31);
    else if (accountType === '미래연금') targetRows = allRows.slice(33, 46);

    const stockData = targetRows.map((row, index) => ({
      id: index + 1, tradeType: row[1] || '', stockType: row[2] || '', name: row[3] || '', ticker: row[4] || '',
      currentPrice: parseNumber(row[5] || ''), purchasePrice: parseNumber(row[6] || ''), quantity: parseNumber(row[7] || ''),
      totalPurchase: parseNumber(row[8] || ''), returnRate: parseNumber(row[9] || ''), returnAmount: parseNumber(row[10] || ''),
      evaluationAmount: parseNumber(row[11] || ''),
    }));
    return c.json({ account: accountType, stocks: stockData, lastUpdated: new Date().toISOString() });
  } catch (error) { return c.json({ error: String(error) }, 500); }
});

app.get("/make-server-cee564ea/asset-status-data", async (c) => {
  try {
    const gid = '2110101642';
    const defaultUrl = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRl0ocjdF_bIA0hnYA_sbLbE5C8NbkWB0VUYJap5Mbb1q6MKMpcIQAWjOkwNBj-mmY9ycIaooJyZrDq/pub?gid=${gid}&single=true&output=csv`;
    
    const { rows } = await fetchSheetData(gid, defaultUrl, "AssetStatus");
    const dataRows = rows.slice(1, 24);
    
    const assetData = dataRows.map((row, index) => ({
      id: index + 1, account: row[0] || '', before2023: parseNumber(row[1] || ''), deposit2024: parseNumber(row[2] || ''),
      estimate2024: parseNumber(row[3] || ''), end2024: parseNumber(row[4] || ''), planDiff2024: parseNumber(row[5] || ''),
      increase2023: parseNumber(row[6] || ''), current2025: parseNumber(row[7] || ''), deposit2025: parseNumber(row[8] || ''),
      estimate2025: parseNumber(row[9] || ''), increase2024: parseNumber(row[10] || ''), end2025: parseNumber(row[11] || ''),
      current2026: parseNumber(row[12] || ''), deposit2026: parseNumber(row[13] || ''), estimate2026: parseNumber(row[14] || ''),
      increase2025: parseNumber(row[15] || ''), end2026: parseNumber(row[16] || ''),
    }));
    return c.json({ assets: assetData, lastUpdated: new Date().toISOString() });
  } catch (error) { return c.json({ error: String(error) }, 500); }
});

app.get("/make-server-cee564ea/asset-distribution-data", async (c) => {
  try {
    const accountType = c.req.query('account') || '지윤';
    const gid = '554738190';
    const defaultUrl = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRl0ocjdF_bIA0hnYA_sbLbE5C8NbkWB0VUYJap5Mbb1q6MKMpcIQAWjOkwNBj-mmY9ycIaooJyZrDq/pub?gid=${gid}&single=true&output=csv`;
    
    const { rows: allRows } = await fetchSheetData(gid, defaultUrl, "AssetDistribution");
    
    let totalAmount = 0; let dataRows: string[][] = [];
    if (accountType === '지윤') { totalAmount = parseNumber(allRows[0]?.[0] || ''); dataRows = allRows.slice(2, 12); }
    else if (accountType === '오빠') { totalAmount = parseNumber(allRows[14]?.[0] || ''); dataRows = allRows.slice(16, 26); }
    
    const assetData = dataRows.map((row, index) => ({
      id: index + 1, name: row[0] || '', plannedAmount: parseNumber(row[1] || ''), ratio: parseNumber(row[2] || ''),
      currentInvestment: parseNumber(row[3] || ''), planDiff: parseNumber(row[4] || ''), todayStatus: parseNumber(row[5] || ''),
    }));
    return c.json({ account: accountType, totalAmount, distributions: assetData, lastUpdated: new Date().toISOString() });
  } catch (error) { return c.json({ error: String(error) }, 500); }
});

app.get("/make-server-cee564ea/exchange-rate-data", async (c) => {
  try {
    const gid = '781118673';
    const defaultUrl = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRl0ocjdF_bIA0hnYA_sbLbE5C8NbkWB0VUYJap5Mbb1q6MKMpcIQAWjOkwNBj-mmY9ycIaooJyZrDq/pub?gid=${gid}&single=true&output=csv`;
    
    const { rows: allRows } = await fetchSheetData(gid, defaultUrl, "ExchangeRate");
    return c.json({ usd: parseNumber(allRows[0]?.[1] || ''), jpy: parseNumber(allRows[1]?.[1] || ''), lastUpdated: new Date().toISOString() });
  } catch (error) { return c.json({ error: String(error) }, 500); }
});

app.get("/make-server-cee564ea/watchlist-data", async (c) => {
  try {
    const gid = '2037774778';
    const defaultUrl = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRl0ocjdF_bIA0hnYA_sbLbE5C8NbkWB0VUYJap5Mbb1q6MKMpcIQAWjOkwNBj-mmY9ycIaooJyZrDq/pub?gid=${gid}&single=true&output=csv`;
    
    const { rows } = await fetchSheetData(gid, defaultUrl, "Watchlist");
    const dataRows = rows.slice(1).filter(row => row[0]?.trim());
    
    const watchlistData = dataRows.map((row, index) => ({
      id: index + 1, 
      priceChange: parseNumber(row[0] || ''),
      stockName: row[1] || '',
      ticker: row[2] || '',
      currentPrice: parseNumber(row[3] || ''),
    }));
    return c.json({ items: watchlistData, lastUpdated: new Date().toISOString() });
  } catch (error) { return c.json({ items: [], lastUpdated: new Date().toISOString() }, 200); }
});

app.get("/make-server-cee564ea/market-indices", async (c) => {
  try {
    const symbols = [{ name: 'kospi', symbol: '^KS11' }, { name: 'kosdaq', symbol: '^KQ11' }, { name: 'nasdaq', symbol: '^IXIC' }, { name: 'sp500', symbol: '^GSPC' }];
    const results = await Promise.allSettled(symbols.map(async (s) => {
      const resp = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${s.symbol}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const data = await resp.json();
      const meta = data?.chart?.result?.[0]?.meta;
      const cur = meta.regularMarketPrice || meta.previousClose || 0;
      const prev = meta.chartPreviousClose || meta.previousClose || 0;
      return { name: s.name, currentPrice: cur, change: cur - prev, changePercent: prev > 0 ? ((cur - prev) / prev) * 100 : 0 };
    }));
    const indices: any = { lastUpdated: new Date().toISOString() };
    results.forEach((r, i) => { if (r.status === 'fulfilled') indices[symbols[i].name] = r.value; });
    return c.json(indices);
  } catch (error) { return c.json({ error: String(error) }, 500); }
});

app.get("/make-server-cee564ea/overseas-purchase", async (c) => {
  try {
    const gid = '217718726';
    const defaultUrl = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRl0ocjdF_bIA0hnYA_sbLbE5C8NbkWB0VUYJap5Mbb1q6MKMpcIQAWjOkwNBj-mmY9ycIaooJyZrDq/pub?gid=${gid}&single=true&output=csv`;
    
    const { rows } = await fetchSheetData(gid, defaultUrl, "OverseasPurchase");
    
    const headerRow = rows[0];
    const colNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U'];
    const headers: any = {}; colNames.forEach((col, idx) => headers[col] = headerRow[idx] || col);
    const dataRows = rows.slice(1).filter(row => row[0]?.trim()).map(row => {
      const obj: any = {}; colNames.forEach((col, idx) => obj[col] = row[idx] || ''); return obj;
    });
    return c.json({ headers, data: dataRows, lastUpdated: new Date().toISOString() });
  } catch (error) { 
    return c.json({ error: "Failed to fetch Overseas Purchase data", details: String(error) }, 500); 
  }
});

app.get("/make-server-cee564ea/entry-management", async (c) => {
  try {
    // The user explicitly provided gid=1739777745 for Entry Management in their prompt
    const gid = '1739777745'; 
    const defaultUrl = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRl0ocjdF_bIA0hnYA_sbLbE5C8NbkWB0VUYJap5Mbb1q6MKMpcIQAWjOkwNBj-mmY9ycIaooJyZrDq/pub?gid=${gid}&single=true&output=csv`;
    
    const { rows } = await fetchSheetData(gid, defaultUrl, "EntryManagement");
    
    const headerRow = rows[0];
    const colNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S'];
    const headers: any = {}; colNames.forEach((col, idx) => headers[col] = headerRow[idx] || col);
    const dataRows = rows.slice(1).filter(row => row[0]?.trim()).map(row => {
      const obj: any = {}; colNames.forEach((col, idx) => obj[col] = row[idx] || ''); return obj;
    });
    return c.json({ headers, data: dataRows, lastUpdated: new Date().toISOString() });
  } catch (error) { 
    console.log("Error in entry-management route:", error);
    return c.json({ error: "Failed to fetch Entry Management data", details: String(error) }, 500); 
  }
});

// ===== 자산관리 시스템 CRUD API =====

// 계좌 데이터 전체 조회
app.get("/make-server-cee564ea/accounts", async (c) => {
  try {
    const data = await kv.get("asset_accounts");
    return c.json({ accounts: data || [], lastUpdated: new Date().toISOString() });
  } catch (error) { return c.json({ error: String(error) }, 500); }
});

// 계좌 데이터 저장 (전체 덮어쓰기)
app.post("/make-server-cee564ea/accounts", async (c) => {
  try {
    const body = await c.req.json();
    await kv.set("asset_accounts", body.accounts);
    return c.json({ success: true, lastUpdated: new Date().toISOString() });
  } catch (error) { return c.json({ error: String(error) }, 500); }
});

// 일별 스냅샷 저장
app.post("/make-server-cee564ea/snapshots", async (c) => {
  try {
    const body = await c.req.json();
    const existing = await kv.get("asset_snapshots") || [];
    const idx = existing.findIndex((s: any) => s.date === body.date);
    if (idx >= 0) existing[idx] = body;
    else existing.push(body);
    const sorted = existing.sort((a: any, b: any) => b.date.localeCompare(a.date)).slice(0, 365);
    await kv.set("asset_snapshots", sorted);
    return c.json({ success: true });
  } catch (error) { return c.json({ error: String(error) }, 500); }
});

// 일별 스냅샷 조회
app.get("/make-server-cee564ea/snapshots", async (c) => {
  try {
    const data = await kv.get("asset_snapshots");
    return c.json({ snapshots: data || [], lastUpdated: new Date().toISOString() });
  } catch (error) { return c.json({ error: String(error) }, 500); }
});

Deno.serve(app.fetch);
