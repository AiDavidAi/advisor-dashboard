import { BASKETS, ALL_TICKERS } from './baskets.js';
import { $, $$, setActiveNav, usageText, getCfg, saveCfg, showBanner, pingFMP, fetchSeriesMany, lastClose, dayChangePct } from './shared.js';

let SERIES = {}; let TIMER = null;

function renderSections(){
  const root = document.getElementById("sections"); root.innerHTML = "";
  BASKETS.forEach(b => {
    const sec = document.createElement("div"); sec.className="section";
    sec.innerHTML = `<h3>${b.name}</h3><div class="table"><div class="thead"><span>Ticker</span><span>Name</span><span>Last (EOD)</span><span>Δ 1D</span></div><div class="tbody"></div></div>`;
    const tbody = sec.querySelector(".tbody");
    b.members.forEach(m => {
      const s = SERIES[m.t]; const last = lastClose(s); const day = dayChangePct(s);
      const row=document.createElement("div"); row.className="tr"; row.dataset.ticker=m.t.toLowerCase(); row.dataset.name=(m.n||m.t).toLowerCase();
      row.innerHTML = `<span class="tk"><strong>${m.t}</strong></span><span>${m.n || m.t}</span><span>${last!=null ? Number(last).toFixed(2) : "—"}</span><span class="${day!=null ? (day>=0?"up":"down"):""}">${day!=null ? ((day>0?"+":"")+ (day*100).toFixed(2) + "%") : "—"}</span>`;
      tbody.appendChild(row);
    });
    root.appendChild(sec);
  });
}

function bindSearch(){
  const input = document.getElementById("search");
  input.addEventListener("input", ()=>{
    const q = input.value.trim().toLowerCase();
    document.querySelectorAll(".tr").forEach(tr => {
      const show = !q || tr.dataset.ticker.includes(q) || tr.dataset.name.includes(q);
      tr.style.display = show ? "" : "none";
    });
  });
}

async function reloadSeries(){
  const map = await fetchSeriesMany(ALL_TICKERS);
  SERIES = {...map};
  const usage = document.getElementById("usage"); if (usage) usage.textContent = usageText();
  renderSections();
}

function scheduleCheck(){
  if (TIMER) clearInterval(TIMER);
  const hrs = Number(getCfg().checkIntervalHrs || 6);
  TIMER = setInterval(reloadSeries, Math.max(1, hrs)*3600*1000);
}

function renderHeaderControls(){
  document.getElementById("refreshNow").addEventListener("click", reloadSeries);
}

async function main(){
  setActiveNav("etfs.html");
  renderHeaderControls();
  renderSections();
  await reloadSeries();
  bindSearch();
  scheduleCheck();
}
main();
