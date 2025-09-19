import { BASKETS } from './baskets.js';
import { PERIODS, $, $$, fmtPct, fmtNum, drawSpark, pickStartIndex, pctChange, fetchSeriesMany, setActiveNav, usageText, getCfg, saveCfg, showBanner, pingFMP, lastClose, dayChangePct } from './shared.js';

let SERIES = {}; let CURRENT_PERIOD = "1M"; let TIMER = null;

function renderHeaderControls(){
  const usage = document.getElementById("usage");
  if (usage) usage.textContent = usageText();
  const btn = document.getElementById("openSettings");
  const modal = document.getElementById("settingsModal");
  const close = document.getElementById("closeSettings");
  const save = document.getElementById("saveSettings");

  const key = document.getElementById("apikey");
  const sttl = document.getElementById("seriesTtlHours");
  const budget = document.getElementById("dailyBudget");
  const ivl = document.getElementById("checkIntervalHrs");

  const cfg = getCfg();
  key.value = cfg.apiKey; sttl.value = cfg.seriesTtlHours; budget.value = cfg.dailyBudget; ivl.value = cfg.checkIntervalHrs;

  document.getElementById("refreshNow").addEventListener("click", reloadSeries);

  btn.addEventListener("click", ()=> modal.classList.add("show"));
  close.addEventListener("click", ()=> modal.classList.remove("show"));
  save.addEventListener("click", async ()=> {
    saveCfg({ apiKey:key.value.trim(), seriesTtlHours:Math.max(1,Number(sttl.value||1)), dailyBudget:Math.max(1,Number(budget.value||1)), checkIntervalHrs:Math.max(1,Number(ivl.value||1)) });
    const ping = await pingFMP();
    if (ping.ok){ showBanner('Connected to FMP (EOD) ✅ — reloading series…'); } else { showBanner('FMP connection problem ('+ping.reason+').', 'error'); }
    SERIES = {}; await reloadSeries(); modal.classList.remove("show"); if (usage) usage.textContent = usageText(); scheduleCheck();
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
          <span>Ticker</span><span>Last (EOD)</span><span>Δ 1D</span><span>Period</span>
        </div>
        <div class="mini-body"></div>
      </div>
      <div class="chips"><span class="chip small">Series loaded (EOD)</span></div>
    `;
    grid.appendChild(box);
    let sum=0, count=0; const miniBody=box.querySelector(".mini-body");
    b.members.forEach(m => {
      const s = SERIES[m.t];
      const last = lastClose(s);
      const day = dayChangePct(s);
      let periodChg = null;
      if (s && s.length>1){
        const idx = (function(series){ const now=series.at(-1).t; if (PERIODS[CURRENT_PERIOD]?.ytd){ const d=new Date(now), jan1=new Date(d.getFullYear(),0,1).getTime(); let i=series.findIndex(p=>p.t>=jan1); if(i<0)i=0; if(i>=series.length-1)i=series.length-2; return i; } const back=(PERIODS[CURRENT_PERIOD].days||31)*24*3600*1000, target=now-back; let i=series.findIndex(p=>p.t>=target); if(i<0)i=0; if(i>=series.length-1)i=series.length-2; return i; })(s);
        periodChg = (s && s[idx]) ? (s[s.length-1].c - s[idx].c) / s[idx].c : null;
        if (isFinite(periodChg)) { sum += periodChg; count++; }
      }
      const tr = document.createElement("div"); tr.className="mini-row";
      tr.innerHTML = `
        <span><strong>${m.t}</strong></span>
        <span>${last!=null ? (Number(last).toFixed(2)) : "—"}</span>
        <span class="${day!=null ? (day>=0?"up":"down"):""}">${day!=null ? ((day>0?"+":"")+ (day*100).toFixed(2) + "%") : "—"}</span>
        <span class="${periodChg!=null ? (periodChg>=0?"up":"down"):""}">${periodChg!=null ? ((periodChg>0?"+":"")+ (periodChg*100).toFixed(2) + "%") : "—"}</span>
      `;
      miniBody.appendChild(tr);
    });
    const avg = count>0 ? sum/count : null; const mEl=box.querySelector(".metric .chg"); if (avg==null){ mEl.textContent="—"; mEl.className="chg"; } else { mEl.textContent=((avg>0?"+":"")+ (avg*100).toFixed(2) + "%"); mEl.className="chg " + (avg>=0?"up":"down"); }

    // sparkline: 70-day averaged index of included tickers
    const spark = box.querySelector(".spark"); const lookback=70; const allSeries=b.members.map(m=>SERIES[m.t]).filter(Boolean); const union=new Set(); allSeries.forEach(s=>s.forEach(p=>union.add(p.t))); const stamps=Array.from(union).sort((a,b)=>a-b).filter(t=>t>=Date.now()-lookback*24*3600*1000);
    if (stamps.length>5){ const idxVals=[]; let base=null; stamps.forEach(t=>{ let sumClose=0,cnt=0; allSeries.forEach(s=>{ const pt=s.find(p=>p.t===t); if(pt){ sumClose+=pt.c; cnt++; } }); if(cnt>0){ const avgClose=sumClose/cnt; if(base==null) base=avgClose; idxVals.push(avgClose/base); } }); const ctx=spark.getContext('2d'); const w=spark.clientWidth,h=spark.clientHeight; if(spark.width!==w)spark.width=w; if(spark.height!==h)spark.height=h; const min=Math.min(...idxVals),max=Math.max(...idxVals),pad=4; const sx=(w-pad*2)/(idxVals.length-1), sy=(h-pad*2)/(max-min||1); ctx.clearRect(0,0,w,h); ctx.lineWidth=2; const g=ctx.createLinearGradient(0,0,w,0); g.addColorStop(0,'#4dc3ff'); g.addColorStop(1,'#7bf1a8'); ctx.strokeStyle=g; ctx.beginPath(); idxVals.forEach((v,i)=>{ const x=pad+i*sx, y=h-pad-(v-min)*sy; if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke(); } else { const ctx=spark.getContext('2d'); ctx.clearRect(0,0,spark.clientWidth,spark.clientHeight); }
  });
}

async function reloadSeries(){
  const all = Array.from(new Set(BASKETS.flatMap(b => b.members.map(m => m.t))));
  const map = await fetchSeriesMany(all);
  SERIES = {...map};
  const usage = document.getElementById("usage"); if (usage) usage.textContent = usageText();
  renderBaskets();
}

function scheduleCheck(){
  if (TIMER) clearInterval(TIMER);
  const hrs = Number(getCfg().checkIntervalHrs || 6);
  TIMER = setInterval(reloadSeries, Math.max(1, hrs)*3600*1000); // will hit cache until TTL expires
}

async function start(){
  setActiveNav("index.html");
  renderHeaderControls();
  renderPeriodControls();
  showBanner('EOD‑only mode: prices are last close; changes use EOD vs prior day.');
  await reloadSeries();
  scheduleCheck();
}
start();
