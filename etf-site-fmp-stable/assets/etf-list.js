import { BASKETS, ALL_TICKERS } from './baskets.js';
import { $, $$, fetchQuotes, fmtPct, fmtNum, setActiveNav, usageText, getCfg, saveCfg, showBanner, pingFMP } from './shared.js';

let QUOTES = {}; let REFRESH_TIMER = null;

function renderSections(){
  const root = document.getElementById("sections"); root.innerHTML = "";
  BASKETS.forEach(b => {
    const sec = document.createElement("div"); sec.className="section";
    sec.innerHTML = `<h3>${b.name}</h3><div class="table"><div class="thead"><span>Ticker</span><span>Name</span><span>Last</span><span>Δ 1D</span></div><div class="tbody"></div></div>`;
    const tbody = sec.querySelector(".tbody");
    b.members.forEach(m => {
      const q = QUOTES[m.t]; const row=document.createElement("div"); row.className="tr"; row.dataset.ticker=m.t.toLowerCase(); row.dataset.name=(m.n||m.t).toLowerCase();
      row.innerHTML = `<span class="tk"><strong>${m.t}</strong></span><span>${m.n || m.t}</span><span>${q?.price!=null ? Number(q.price).toFixed(2) : "—"}</span><span class="${q?.chg!=null ? (q.chg>=0?"up":"down"):""}">${q?.chg!=null ? ((q.chg>0?"+":"")+ (q.chg*100).toFixed(2) + "%") : "—"}</span>`;
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

async function refreshQuotes(){
  QUOTES = await fetchQuotes(ALL_TICKERS);
  const usage = document.getElementById("usage"); if (usage) usage.textContent = usageText();
  renderSections();
}

function scheduleAutoRefresh(){
  if (REFRESH_TIMER) clearInterval(REFRESH_TIMER);
  const ms = Number(getCfg().refreshMs || 0);
  if (ms>0) REFRESH_TIMER = setInterval(refreshQuotes, ms);
}

function renderHeaderControls(){
  document.getElementById("refreshNow").addEventListener("click", refreshQuotes);
}

async function main(){
  setActiveNav("etfs.html");
  renderHeaderControls();
  await refreshQuotes();
  bindSearch();
  scheduleAutoRefresh();
}
main();
