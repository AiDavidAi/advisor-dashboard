import { ALL_TICKERS } from './baskets.js';

export const PERIODS = {"1W":{days:7},"1M":{days:31},"3M":{days:93},"YTD":{ytd:true},"1Y":{days:366},"3Y":{days:366*3}};
export const $ = (s,r=document)=>r.querySelector(s);
export const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
export const fmtPct = x => (x==null||isNaN(x)) ? "—" : `${x>0?"+":""}${(x*100).toFixed(2)}%`;
export const fmtNum = (x,d=2) => (x==null||isNaN(x)) ? "—" : Number(x).toFixed(d);
export function setActiveNav(current){ $$('a.navlink').forEach(a=>{ a.classList.toggle('active', current.endsWith(a.getAttribute('href'))); }); }
export function pctChange(a,b){ return (b - a) / a; }

/* Settings & Budget */
const LS_KEY = 'fmpStableEODCfgV1';
const DCOUNT_KEY_PREFIX = 'FMP_REQS_';
export function getCfg(){
  try{ const s=JSON.parse(localStorage.getItem(LS_KEY)||'{}'); return {
    apiKey:s.apiKey||'',
    seriesTtlHours:Number(s.seriesTtlHours??24),
    dailyBudget:Number(s.dailyBudget??250),
    checkIntervalHrs:Number(s.checkIntervalHrs??6)
  }; }catch{ return {apiKey:'', seriesTtlHours:24, dailyBudget:250, checkIntervalHrs:6}; }
}
export function saveCfg(patch){ const curr=getCfg(); localStorage.setItem(LS_KEY, JSON.stringify({...curr, ...(patch||{})})); }
function todayKey(){ const d=new Date(); return DCOUNT_KEY_PREFIX + d.toISOString().slice(0,10); }
export function getTodayUsage(){ return Number(localStorage.getItem(todayKey()) || 0); }
function incUsage(n){ const k=todayKey(); const cur=getTodayUsage(); localStorage.setItem(k, String(cur + (n||1))); }
export function remainingBudget(){ const cfg=getCfg(); return Math.max(0, cfg.dailyBudget - getTodayUsage()); }
function cacheKey(url){ return 'FMP_CACHE_' + btoa(url); }
function getCache(url){ try{ const raw=localStorage.getItem(cacheKey(url)); if(!raw) return null; const {data, expiry}=JSON.parse(raw); if(Date.now()<expiry) return data; return null; }catch{return null;} }
function setCache(url,data,ttlMs){ try{ localStorage.setItem(cacheKey(url), JSON.stringify({data, expiry: Date.now()+ttlMs})); }catch{} }

/* Banner */
export function showBanner(msg, kind='info'){
  const b = document.getElementById('banner'); if(!b) return;
  b.classList.add('show');
  b.style.color = kind==='error' ? '#ffd1d1' : '#d7e3ff';
  b.innerHTML = msg;
  if (kind!=='error') setTimeout(()=>{ b.classList.remove('show'); }, 6000);
}

const FMP_BASE = 'https://financialmodelingprep.com/stable';

/* Generic GET with EOD caching */
async function fmpGET(url, {ttlMs=0, budgetCost=1}={}){
  const cfg=getCfg();
  const withKey = `${url}${url.includes('?') ? '&':'?'}apikey=${encodeURIComponent(cfg.apiKey)}`;
  if (ttlMs>0){ const cached=getCache(withKey); if(cached) return {json:cached, fromCache:true, status:200, url:withKey}; }
  if (remainingBudget() < budgetCost){ console.warn('Budget exhausted; skipping fetch', withKey); showBanner('FMP daily budget reached — using cached EOD.', 'error'); return {json:null, fromCache:false, error:'budget', status:0, url:withKey}; }
  let res;
  try { res = await fetch(withKey,{cache:'no-store'}); }
  catch (e){ console.warn('FMP network error', e); showBanner('Network error contacting FMP — using cache.', 'error'); return {json:null, fromCache:false, error:'network', status:0, url:withKey}; }
  if(!res.ok){
    let payload=null; try{payload=await res.json();}catch{}
    console.warn('FMP error', res.status, payload, 'for', withKey);
    showBanner('FMP error '+res.status+' on ' + url + ' — using cache if available.', 'error');
    return {json:null, fromCache:false, error:res.status, status:res.status, url:withKey};
  }
  const json=await res.json(); incUsage(budgetCost); if(ttlMs>0) setCache(withKey,json,ttlMs); return {json, fromCache:false, status:200, url:withKey};
}

/* EOD Historical (per symbol) */
export async function fmpHistoricalSingle(symbol, useFull=false){
  const now=new Date(); // Cache roughly until next market morning
  const tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,6,0,0);
  const ttl=Math.max(1,tomorrow.getTime()-now.getTime());
  const path = useFull ? '/historical-price-eod/full' : '/historical-price-eod/light';
  const url = `${FMP_BASE}${path}?symbol=${encodeURIComponent(symbol)}`;
  const resp=await fmpGET(url,{ttlMs:ttl,budgetCost:1});
  if(resp.error){
    if(!useFull){ // try FULL once
      return await fmpHistoricalSingle(symbol, true);
    }
    return null;
  }
  const arr = resp.json || [];
  return arr
    .filter(p=>p && p.date && (p.close!=null))
    .map(p=>({t: new Date(p.date).getTime(), c: Number(p.close)}))
    .sort((a,b)=>a.t-b.t);
}

export async function fetchSeriesMany(symbols){
  const cfg=getCfg(); if(!cfg.apiKey){ console.warn('No FMP key; EOD series cannot be loaded.'); showBanner('Add your FMP key in ⚙️ Settings to load EOD prices.'); return {}; }
  const out={};
  for (const s of symbols){
    const series = await fmpHistoricalSingle(s, false);
    if (series && series.length) out[s]=series;
  }
  return out;
}

export function usageText(){ const d=Number(localStorage.getItem('FMP_REQS_'+(new Date()).toISOString().slice(0,10))||0); const limit=getCfg().dailyBudget; return `FMP EOD ${d}/${limit}`; }

/* "Ping" uses a FREE EOD endpoint (not quotes) */
export async function pingFMP(){
  const cfg=getCfg();
  if(!cfg.apiKey) return {ok:false, reason:'no-key'};
  const url = `${FMP_BASE}/historical-price-eod/light?symbol=AAPL&apikey=${encodeURIComponent(cfg.apiKey)}`;
  try{
    const res = await fetch(url, {cache:'no-store'});
    if(!res.ok) return {ok:false, reason:'HTTP '+res.status};
    const j = await res.json();
    if (Array.isArray(j) && j.length && j[0]?.date) return {ok:true};
    return {ok:false, reason:'unexpected-response'};
  }catch(e){
    return {ok:false, reason:'network'};
  }
}

/* Helpers from EOD to "Last" and 1D change */
export function lastClose(series){
  if(!series || series.length===0) return null;
  return series.at(-1).c;
}
export function dayChangePct(series){
  if(!series || series.length<2) return null;
  const a = series.at(-2).c, b = series.at(-1).c;
  return (b - a) / a;
}

export function pickStartIndex(series, key){
  if (!series || series.length<2) return null;
  const now=series.at(-1).t;
  if (PERIODS[key]?.ytd){
    const d=new Date(now), jan1=new Date(d.getFullYear(),0,1).getTime();
    let idx=series.findIndex(p=>p.t>=jan1); if(idx<0)idx=0; if(idx>=series.length-1)idx=series.length-2; return idx;
  }
  const back=(PERIODS[key].days||31)*24*3600*1000, target=now-back;
  let idx=series.findIndex(p=>p.t>=target); if(idx<0)idx=0; if(idx>=series.length-1)idx=series.length-2; return idx;
}

export function drawSpark(canvas, values){
  const ctx = canvas.getContext('2d');
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width!==w) canvas.width=w; if (canvas.height!==h) canvas.height=h;
  ctx.clearRect(0,0,w,h);
  if (!values || values.length<2){ ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillText('no data',8,h/2); return; }
  const min=Math.min(...values), max=Math.max(...values), pad=4;
  const sx=(w-pad*2)/(values.length-1), sy=(h-pad*2)/(max-min||1);
  ctx.lineWidth=2; const g=ctx.createLinearGradient(0,0,w,0); g.addColorStop(0,'#4dc3ff'); g.addColorStop(1,'#7bf1a8'); ctx.strokeStyle=g;
  ctx.beginPath();
  values.forEach((v,i)=>{ const x=pad+i*sx, y=h-pad-(v-min)*sy; if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y); });
  ctx.stroke();
}
