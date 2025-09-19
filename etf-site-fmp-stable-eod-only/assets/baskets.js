// Update these to match your strategy document as needed.
export const BASKETS = [
  { name: "Bitcoin (BTC) & Bitcoin ETFs", key: "bitcoin", members: [
    {t: "IBIT", n: "iShares Bitcoin Trust"},
    {t: "BITO", n: "ProShares Bitcoin Strategy ETF"},
    {t: "BITX", n: "2x Bitcoin Strategy ETF"},
    {t: "BITI", n: "ProShares Short Bitcoin ETF"},
    {t: "SBIT", n: "ProShares UltraShort Bitcoin ETF"}
  ]},
  { name: "Solana (SOL)", key: "solana", members: [
    {t: "SOLZ", n: "Solana ETF"},
    {t: "SOLT", n: "2x Solana ETF"}
  ]},
  { name: "Ethereum (ETH)", key: "ethereum", members: [
    {t: "ETHA", n: "iShares Ethereum Trust ETF"},
    {t: "FETH", n: "Fidelity Ethereum Fund ETF"}
  ]},
  { name: "Disruptive AI Companies", key: "ai", members: [
    {t: "BOTZ", n: "Global X Robotics & AI ETF"},
    {t: "AIQ", n: "Global X AI & Technology ETF"},
    {t: "WTAI", n: "WisdomTree AI & Innovation ETF"}
  ]},
  { name: "Crypto / Blockchain (General)", key: "crypto", members: [
    {t: "BITQ", n: "Bitwise Crypto Industry Innovators"},
    {t: "BLOK", n: "Amplify Transformational Data Sharing ETF"},
    {t: "BKCH", n: "Global X Blockchain ETF"},
    {t: "BITW", n: "Bitwise Crypto Industry Innovators ETF"},
    {t: "FDIG", n: "Fidelity Crypto Industry and Digital Payments"}
  ]},
  { name: "Water Resources & Desalination", key: "water", members: [
    {t: "AQWA", n: "Global X Clean Water ETF"},
    {t: "PHO", n: "Invesco Water Resources ETF"},
    {t: "CGW", n: "Invesco S&P Global Water Index ETF"}
  ]},
  { name: "Nuclear Technologies (Fusion/Fission/SMRs)", key: "nuclear", members: [
    {t: "URA", n: "Global X Uranium ETF"},
    {t: "URNM", n: "Sprott Uranium Miners ETF"},
    {t: "NLR", n: "VanEck Uranium & Nuclear ETF"},
    {t: "NUCL", n: "iShares Nuclear & Energy ETF"}
  ]},
  { name: "Electrification (EVs, Grid, Charging)", key: "electrification", members: [
    {t: "LIT", n: "Global X Lithium & Battery Tech ETF"},
    {t: "DRIV", n: "Global X Autonomous & EVs ETF"},
    {t: "IDRV", n: "iShares Self-Driving EV & Tech ETF"},
    {t: "VOLT", n: "Tema Electrification ETF"}
  ]}
];

export const ALL_TICKERS = Array.from(new Set(BASKETS.flatMap(b => b.members.map(m => m.t))));
