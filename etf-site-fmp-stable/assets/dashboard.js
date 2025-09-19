import { BASKETS } from './baskets.js';
import { PERIODS, $, $$, fmtPct, fmtNum, drawSpark, pickStartIndex, pctChange, fetchSeriesMany, fetchQuotes, setActiveNav, usageText, getCfg, saveCfg, showBanner, pingFMP } from './shared.js';

let SERIES = {}; let QUOTES = {}; let CURRENT_PERIOD = "1D"; let REFRESH_TIMER = null;

function renderHeaderControls(){
  const usage = document.getElementById("usage");
  if (usage) usage.textContent = usageText();
  const btn = document.getElementById("openSettings");
  const modal = document.getElementById("settingsModal");
  const close = document.getElementById("closeSettings");
  const save = document.getElementById("saveSettings");

  const key = document.getElementById("apikey");
  const refresh = document.getElementById("refreshMs");
  const qttl = document.getElementById("quotesTtlMs");
  const sttl = document.getElementById("seriesTtlHours");
  const budget = document.getElementById("dailyBudget");
  const intraday = document.getElementById("useIntraday");

  const cfg = getCfg();
  key.value = cfg.apiKey; refresh.value = cfg.refreshMs/1000; qttl.value = cfg.quotesTtlMs/1000; sttl.value = cfg.seriesTtlHours; budget.value = cfg.dailyBudget; intraday.checked = cfg.useIntraday;

  document.getElementById("refreshNow").addEventListener("click", async ()=> { if (!Object.keys(SERIES).length) { await loadSeries(); } await refreshQuotes(); });

  btn.addEventListener("click", ()=> modal.classList.add("show"));
  close.addEventListener("click", ()=> modal.classList.remove("show"));
  save.addEventListener("click", async ()=> {
    saveCfg({ apiKey:key.value.trim(), refreshMs:Math.max(0,Number(refresh.value||0)*1000), quotesTtlMs:Math.max(0,Number(qttl.value||0)*1000), seriesTtlHours:Math.max(1,Number(sttl.value||1)), dailyBudget:Math.max(1,Number(budget.value||1)), useIntraday: intraday.checked });
    const ping = await pingFMP();
    if (ping.ok){ showBanner('Connected to FMP (stable) ✅ — reloading data…'); } else { showBanner('FMP (stable) connection problem ('+ping.reason+'). Falling back to Yahoo if possible.', 'error'); }
    SERIES = {}; // force fresh series with the new key
    await loadSeries();
    await refreshQuotes();
    modal.classList.remove("show"); scheduleAutoRefresh(); if (usage) usage.textContent = usageText();
  });
}

function renderPeriodControls(){
  const bar = document.getElementById("periodControls");
  bar.addEventListener("click", (e)=>{ const btn = e.target.closest("button.btn"); if(!btn) return; $$(".controls .btn").forEach(b=>b.classList.remove("active")); btn.classList.add("active"); CURRENT_PERIOD = btn.dataset.period; renderBaskets(); });
}

function renderBaskets(){
  const grid = document.getElementById("basketGrid"); grid.innerHTML = "";
  BASKETS.forEach(b => {
    const box = document.createElement("div");
    box.className = "basket";
    box.innerHTML = `
      <div class="row hdr">
        <h4>${b.name}</h4>
        <div class="metric"><span class="small">Avg</span><span class="chg">—</span></div>
      </div>
      <canvas class="spark"></canvas>
      <div class="mini-table">
        <div class="mini-head">
          <span>Ticker</span><span>Last</span><span>Δ 1D</span><span>Period</span>
        </div>
        <div class="mini-body"></div>
      </div>
      <div class="chips"><span class="chip small">Loaded: <span class="dload">0</span>/<span class="dtotal">${b.members.length}</span></span></div>
    `;
    grid.appendChild(box);
    let sum=0, count=0; const miniBody=box.querySelector(".mini-body");
    b.members.forEach(m => {
      const s = SERIES[m.t]; const q = QUOTES[m.t];
      let periodChg = null;
      if (s && s.length>1){
        const now=s.at(-1).t;
        const idx = (function(series){ const now=series.at(-1).t; if (PERIODS[CURRENT_PERIOD]?.ytd){ const d=new Date(now), jan1=new Date(d.getFullYear(),0,1).getTime(); let i=series.findIndex(p=>p.t>=jan1); if(i<0)i=0; if(i>=series.length-1)i=series.length-2; return i; } const back=(PERIODS[CURRENT_PERIOD].days||1)*24*3600*1000, target=now-back; let i=series.findIndex(p=>p.t>=target); if(i<0)i=0; if(i>=series.length-1)i=series.length-2; return i; })(s);
        periodChg = (s && s[idx]) ? (s[s.length-1].c - s[idx].c) / s[idx].c : null;
        if (isFinite(periodChg)) { sum += periodChg; count++; }
      }
      const tr = document.createElement("div"); tr.className="mini-row";
      const last = q?.price ?? null; const day = q?.chg ?? null;
      tr.innerHTML = `
        <span><strong>${m.t}</strong></span>
        <span>${last!=null ? (Number(last).toFixed(2)) : "—"}</span>
        <span class="${day!=null ? (day>=0?"up":"down"):""}">${day!=null ? ((day>0?"+":"")+ (day*100).toFixed(2) + "%") : "—"}</span>
        <span class="${periodChg!=null ? (periodChg>=0?"up":"down"):""}">${periodChg!=null ? ((periodChg>0?"+":"")+ (periodChg*100).toFixed(2) + "%") : "—"}</span>
      `;
      miniBody.appendChild(tr);
    });
    const avg = count>0 ? sum/count : null; const mEl=box.querySelector(".metric .chg"); if (avg==null){ mEl.textContent="—"; mEl.className="chg"; } else { mEl.textContent=((avg>0?"+":"")+ (avg*100).toFixed(2) + "%"); mEl.className="chg " + (avg>=0?"up":"down"); }
    const spark = box.querySelector(".spark"); const lookback=70; const allSeries=b.members.map(m=>SERIES[m.t]).filter(Boolean); const union=new Set(); allSeries.forEach(s=>s.forEach(p=>union.add(p.t))); const stamps=Array.from(union).sort((a,b)=>a-b).filter(t=>t>=Date.now()-lookback*24*3600*1000);
    if (stamps.length>5){ const idxVals=[]; let base=null; stamps.forEach(t=>{ let sumClose=0,cnt=0; allSeries.forEach(s=>{ const pt=s.find(p=>p.t===t); if(pt){ sumClose+=pt.c; cnt++; } }); if(cnt>0){ const avgClose=sumClose/cnt; if(base==null) base=avgClose; idxVals.push(avgClose/base); } }); const ctx=spark.getContext('2d'); const w=spark.clientWidth,h=spark.clientHeight; if(spark.width!==w)spark.width=w; if(spark.height!==h)spark.height=h; const min=Math.min(...idxVals),max=Math.max(...idxVals),pad=4; const sx=(w-pad*2)/(idxVals.length-1), sy=(h-pad*2)/(max-min||1); ctx.clearRect(0,0,w,h); ctx.lineWidth=2; const g=ctx.createLinearGradient(0,0,w,0); g.addColorStop(0,'#4dc3ff'); g.addColorStop(1,'#7bf1a8'); ctx.strokeStyle=g; ctx.beginPath(); idxVals.forEach((v,i)=>{ const x=pad+i*sx, y=h-pad-(v-min)*sy; if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke(); } else { const ctx=spark.getContext('2d'); ctx.clearRect(0,0,spark.clientWidth,spark.clientHeight); }
  });
}

async function loadSeries(){
  const all = Array.from(new Set(BASKETS.flatMap(b => b.members.map(m => m.t))));
  const map = await fetchSeriesMany(all);
  SERIES = {...SERIES, ...map};
}

async function refreshQuotes(){
  const all = Array.from(new Set(BASKETS.flatMap(b => b.members.map(m => m.t))));
  QUOTES = await fetchQuotes(all);
  const usage = document.getElementById("usage"); if (usage) usage.textContent = usageText();
  renderBaskets();
}

function scheduleAutoRefresh(){
  if (REFRESH_TIMER) clearInterval(REFRESH_TIMER);
  const ms = Number(getCfg().refreshMs || 0);
  if (ms>0) REFRESH_TIMER = setInterval(refreshQuotes, ms);
}

async function start(){
  setActiveNav("index.html");
  renderHeaderControls();
  await loadSeries();
  await refreshQuotes();
  scheduleAutoRefresh();
}
start();
