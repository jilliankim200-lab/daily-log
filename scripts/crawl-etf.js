const puppeteer = require('puppeteer');
const { createClient } = require('../node_modules/@supabase/supabase-js');

const supabase = createClient(
  'https://gvalfmtmslnykmwegwfi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2YWxmbXRtc2xueWttd2Vnd2ZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NTc2MTQsImV4cCI6MjA3ODQzMzYxNH0.kLOgm2ag31ZW3qD-AmVsp-yK2aCZcvIeU-Xn6D-wElw'
);

const TABLE = 'kv_store_cee564ea';

function parseNum(s) {
  return parseFloat((s || '').replace(/[^0-9.\-]/g, '')) || 0;
}

function extractETFs(rows) {
  const etfs = [];
  for (const cells of rows) {
    if (cells.length < 11) continue;
    const td0parts = cells[0].split('|').filter(Boolean);
    const name = td0parts[0] || '';
    const ticker = td0parts[1] || '';
    const isMonthly = td0parts.includes('월');
    const price = parseNum(cells[1].split('|')[0]);
    const annualYield = parseNum(cells[9]);
    const td10parts = cells[10].split('|');
    const recentDividend = parseNum(td10parts[0]);
    const recentDivDate = td10parts[1] || '';
    const issuer = cells[3] || '';
    const netAsset = parseNum(cells[2]);
    if (name && ticker && price > 0) {
      etfs.push({ name, ticker, price, annualYield, recentDividend, recentDivDate, issuer, isMonthly: true, netAsset });
    }
  }
  return etfs;
}

async function getRows(page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('tbody tr'))
      .filter(row => row.querySelectorAll('td').length >= 10)
      .map(row => Array.from(row.querySelectorAll('td')).map(td => td.innerText.replace(/\n/g, '|')));
  });
}

async function crawl() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // Go to main page first, click "월배당"
  console.log('Loading main page...');
  await page.goto('https://www.etfcheck.co.kr/mobile/main', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // Close any popup
  await page.evaluate(() => {
    const closeBtn = document.querySelector('[class*="close"], .close, button');
    const btns = Array.from(document.querySelectorAll('button'));
    const closePopup = btns.find(b => b.textContent.includes('닫기') || b.textContent.includes('오늘 그만보기'));
    if (closePopup) closePopup.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Click "월배당" keyword
  const clicked = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a, button, span, div'));
    const monthlyBtn = links.find(el => el.textContent.trim() === '월배당');
    if (monthlyBtn) {
      monthlyBtn.click();
      return 'clicked 월배당';
    }
    return 'not found';
  });
  console.log(clicked);

  // Wait for navigation and data load
  await new Promise(r => setTimeout(r, 5000));

  const url = page.url();
  console.log('Current URL:', url);

  // Check if we're on the screener with monthly filter
  const totalInfo = await page.evaluate(() => {
    const text = document.body.innerText;
    const match = text.match(/검색결과\s*\((\d+)건\)/);
    return match ? match[1] : 'not found';
  });
  console.log(`Total monthly ETFs: ${totalInfo}`);

  // If we're on the screener, switch to 기본정보 tab
  if (url.includes('screener') || url.includes('search')) {
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('a, button, span'));
      const infoTab = tabs.find(t => t.textContent.trim() === '기본정보');
      if (infoTab) infoTab.click();
    });
    await new Promise(r => setTimeout(r, 3000));
  }

  // Collect data - page 1
  const allETFs = new Map();
  let rows = await getRows(page);
  for (const etf of extractETFs(rows)) {
    allETFs.set(etf.ticker, etf);
  }
  console.log(`Page 1: ${rows.length} rows, ${allETFs.size} unique ETFs`);

  // Sort by 연배당률 descending to get different ETFs
  await page.evaluate(() => {
    const ths = Array.from(document.querySelectorAll('th'));
    const yieldTh = ths.find(th => th.textContent.includes('연배당률'));
    if (yieldTh) { yieldTh.click(); yieldTh.click(); }
  });
  await new Promise(r => setTimeout(r, 2000));

  rows = await getRows(page);
  for (const etf of extractETFs(rows)) {
    if (!allETFs.has(etf.ticker)) allETFs.set(etf.ticker, etf);
  }
  console.log(`After yield sort: ${allETFs.size} unique ETFs`);

  // Sort ascending
  await page.evaluate(() => {
    const ths = Array.from(document.querySelectorAll('th'));
    const yieldTh = ths.find(th => th.textContent.includes('연배당률'));
    if (yieldTh) yieldTh.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  rows = await getRows(page);
  for (const etf of extractETFs(rows)) {
    if (!allETFs.has(etf.ticker)) allETFs.set(etf.ticker, etf);
  }
  console.log(`After yield asc: ${allETFs.size} unique ETFs`);

  // Sort by 최근배당 desc
  await page.evaluate(() => {
    const ths = Array.from(document.querySelectorAll('th'));
    const divTh = ths.find(th => th.textContent.includes('최근배당'));
    if (divTh) { divTh.click(); divTh.click(); }
  });
  await new Promise(r => setTimeout(r, 2000));

  rows = await getRows(page);
  for (const etf of extractETFs(rows)) {
    if (!allETFs.has(etf.ticker)) allETFs.set(etf.ticker, etf);
  }
  console.log(`After div sort: ${allETFs.size} unique ETFs`);

  // Sort by 순자산
  await page.evaluate(() => {
    const ths = Array.from(document.querySelectorAll('th'));
    const th = ths.find(th => th.textContent.includes('순자산'));
    if (th) { th.click(); }
  });
  await new Promise(r => setTimeout(r, 2000));

  rows = await getRows(page);
  for (const etf of extractETFs(rows)) {
    if (!allETFs.has(etf.ticker)) allETFs.set(etf.ticker, etf);
  }
  console.log(`After asset sort asc: ${allETFs.size} unique ETFs`);

  // Sort by 현재가 desc
  await page.evaluate(() => {
    const ths = Array.from(document.querySelectorAll('th'));
    const th = ths.find(th => th.textContent.includes('현재가'));
    if (th) { th.click(); th.click(); }
  });
  await new Promise(r => setTimeout(r, 2000));

  rows = await getRows(page);
  for (const etf of extractETFs(rows)) {
    if (!allETFs.has(etf.ticker)) allETFs.set(etf.ticker, etf);
  }
  console.log(`After price sort: ${allETFs.size} unique ETFs`);

  // Sort by TER
  await page.evaluate(() => {
    const ths = Array.from(document.querySelectorAll('th'));
    const th = ths.find(th => th.textContent.includes('TER'));
    if (th) { th.click(); th.click(); }
  });
  await new Promise(r => setTimeout(r, 2000));

  rows = await getRows(page);
  for (const etf of extractETFs(rows)) {
    if (!allETFs.has(etf.ticker)) allETFs.set(etf.ticker, etf);
  }
  console.log(`After TER sort: ${allETFs.size} unique ETFs`);

  await browser.close();

  // Final list
  const monthlyETFs = [...allETFs.values()]
    .filter(e => e.annualYield > 0 && e.recentDividend > 0)
    .sort((a, b) => b.annualYield - a.annualYield)
    .slice(0, 50)
    .map((e, idx) => ({
      rank: idx + 1,
      name: e.name,
      ticker: e.ticker,
      price: e.price,
      annualYield: e.annualYield,
      recentDividend: e.recentDividend,
      recentDivDate: e.recentDivDate,
      issuer: e.issuer,
      netAsset: e.netAsset,
    }));

  console.log(`\nTop ${monthlyETFs.length} Monthly ETFs by yield:`);
  monthlyETFs.forEach(e => {
    console.log(`  #${e.rank} ${e.name} (${e.ticker}) yield:${e.annualYield}% div:${e.recentDividend}원 price:${e.price.toLocaleString()}원 [${e.issuer}]`);
  });

  if (monthlyETFs.length > 0) {
    const { error } = await supabase.from(TABLE).upsert({
      key: 'etf_ranking',
      value: { updatedAt: new Date().toISOString(), data: monthlyETFs },
    });
    if (error) console.error('Supabase error:', error);
    else console.log(`\nSaved ${monthlyETFs.length} monthly ETFs to Supabase`);
  }
}

crawl().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
