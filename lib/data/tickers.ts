// Curated ticker whitelist for the market-impact overlay.
//
// The LLM classifier picks tickers from this list only; anything else is
// dropped server-side. Keeping the list finite (a) prevents hallucinated
// symbols that would fail chart lookups, (b) keeps the prompt small
// (~250 tokens for symbols only), and (c) means every symbol shown to a
// user is guaranteed to have a chart provider that supports it.

export type TickerKind =
  | "equity"
  | "index_etf"   // ETF that proxies a broad index (SPY, QQQ, etc.)
  | "sector_etf"  // Sector rotation ETF (XLE, XLK, ...)
  | "region_etf"  // Country/region ETF (INDA, MCHI, EWJ, ...)
  | "commodity"   // Commodity ETF or continuous future
  | "fx"          // Currency ETF or pair
  | "crypto"      // Crypto ticker
  | "rates";      // Bond / rates ETF

export interface Ticker {
  symbol: string;
  name: string;
  kind: TickerKind;
}

export const TICKER_WHITELIST: Ticker[] = [
  // ── US mega-cap equities ────────────────────────────────────────
  { symbol: "AAPL",  name: "Apple",                 kind: "equity" },
  { symbol: "MSFT",  name: "Microsoft",             kind: "equity" },
  { symbol: "GOOGL", name: "Alphabet",              kind: "equity" },
  { symbol: "AMZN",  name: "Amazon",                kind: "equity" },
  { symbol: "META",  name: "Meta Platforms",        kind: "equity" },
  { symbol: "NVDA",  name: "Nvidia",                kind: "equity" },
  { symbol: "TSLA",  name: "Tesla",                 kind: "equity" },
  { symbol: "BRK.B", name: "Berkshire Hathaway B",  kind: "equity" },
  { symbol: "AVGO",  name: "Broadcom",              kind: "equity" },
  { symbol: "ORCL",  name: "Oracle",                kind: "equity" },
  { symbol: "CRM",   name: "Salesforce",            kind: "equity" },
  { symbol: "ADBE",  name: "Adobe",                 kind: "equity" },
  { symbol: "NFLX",  name: "Netflix",               kind: "equity" },
  { symbol: "DIS",   name: "Disney",                kind: "equity" },
  { symbol: "CSCO",  name: "Cisco",                 kind: "equity" },
  { symbol: "IBM",   name: "IBM",                   kind: "equity" },
  { symbol: "PLTR",  name: "Palantir",              kind: "equity" },
  { symbol: "NOW",   name: "ServiceNow",            kind: "equity" },
  { symbol: "SNAP",  name: "Snap",                  kind: "equity" },
  { symbol: "SPOT",  name: "Spotify",               kind: "equity" },
  { symbol: "UBER",  name: "Uber",                  kind: "equity" },
  { symbol: "ABNB",  name: "Airbnb",                kind: "equity" },
  { symbol: "COIN",  name: "Coinbase",              kind: "equity" },
  { symbol: "HOOD",  name: "Robinhood",             kind: "equity" },
  { symbol: "SQ",    name: "Block",                 kind: "equity" },
  { symbol: "PYPL",  name: "PayPal",                kind: "equity" },
  { symbol: "MSTR",  name: "MicroStrategy",         kind: "equity" },

  // ── Semiconductors ──────────────────────────────────────────────
  { symbol: "AMD",  name: "AMD",                    kind: "equity" },
  { symbol: "INTC", name: "Intel",                  kind: "equity" },
  { symbol: "QCOM", name: "Qualcomm",               kind: "equity" },
  { symbol: "TXN",  name: "Texas Instruments",      kind: "equity" },
  { symbol: "MU",   name: "Micron",                 kind: "equity" },
  { symbol: "ARM",  name: "Arm Holdings",           kind: "equity" },
  { symbol: "MRVL", name: "Marvell",                kind: "equity" },
  { symbol: "TSM",  name: "TSMC",                   kind: "equity" },
  { symbol: "ASML", name: "ASML",                   kind: "equity" },
  { symbol: "SMCI", name: "Super Micro Computer",   kind: "equity" },

  // ── Banks & finance ─────────────────────────────────────────────
  { symbol: "JPM",  name: "JPMorgan",               kind: "equity" },
  { symbol: "BAC",  name: "Bank of America",        kind: "equity" },
  { symbol: "WFC",  name: "Wells Fargo",            kind: "equity" },
  { symbol: "C",    name: "Citigroup",              kind: "equity" },
  { symbol: "GS",   name: "Goldman Sachs",          kind: "equity" },
  { symbol: "MS",   name: "Morgan Stanley",         kind: "equity" },
  { symbol: "BLK",  name: "BlackRock",              kind: "equity" },
  { symbol: "SCHW", name: "Charles Schwab",         kind: "equity" },
  { symbol: "V",    name: "Visa",                   kind: "equity" },
  { symbol: "MA",   name: "Mastercard",             kind: "equity" },
  { symbol: "AXP",  name: "American Express",       kind: "equity" },

  // ── Healthcare & pharma ─────────────────────────────────────────
  { symbol: "JNJ",  name: "Johnson & Johnson",      kind: "equity" },
  { symbol: "UNH",  name: "UnitedHealth",           kind: "equity" },
  { symbol: "LLY",  name: "Eli Lilly",              kind: "equity" },
  { symbol: "MRK",  name: "Merck",                  kind: "equity" },
  { symbol: "PFE",  name: "Pfizer",                 kind: "equity" },
  { symbol: "ABBV", name: "AbbVie",                 kind: "equity" },
  { symbol: "TMO",  name: "Thermo Fisher",          kind: "equity" },
  { symbol: "DHR",  name: "Danaher",                kind: "equity" },
  { symbol: "GILD", name: "Gilead",                 kind: "equity" },
  { symbol: "BMY",  name: "Bristol-Myers Squibb",   kind: "equity" },
  { symbol: "CVS",  name: "CVS Health",             kind: "equity" },

  // ── Energy ──────────────────────────────────────────────────────
  { symbol: "XOM",  name: "ExxonMobil",             kind: "equity" },
  { symbol: "CVX",  name: "Chevron",                kind: "equity" },
  { symbol: "COP",  name: "ConocoPhillips",         kind: "equity" },
  { symbol: "EOG",  name: "EOG Resources",          kind: "equity" },
  { symbol: "SLB",  name: "SLB",                    kind: "equity" },
  { symbol: "OXY",  name: "Occidental Petroleum",   kind: "equity" },

  // ── Industrials, defense, transport ─────────────────────────────
  { symbol: "BA",   name: "Boeing",                 kind: "equity" },
  { symbol: "LMT",  name: "Lockheed Martin",        kind: "equity" },
  { symbol: "RTX",  name: "RTX",                    kind: "equity" },
  { symbol: "NOC",  name: "Northrop Grumman",       kind: "equity" },
  { symbol: "GD",   name: "General Dynamics",       kind: "equity" },
  { symbol: "CAT",  name: "Caterpillar",            kind: "equity" },
  { symbol: "DE",   name: "John Deere",             kind: "equity" },
  { symbol: "GE",   name: "GE Aerospace",           kind: "equity" },
  { symbol: "HON",  name: "Honeywell",              kind: "equity" },
  { symbol: "F",    name: "Ford",                   kind: "equity" },
  { symbol: "GM",   name: "General Motors",         kind: "equity" },
  { symbol: "RIVN", name: "Rivian",                 kind: "equity" },

  // ── Consumer & retail ──────────────────────────────────────────
  { symbol: "WMT",  name: "Walmart",                kind: "equity" },
  { symbol: "COST", name: "Costco",                 kind: "equity" },
  { symbol: "TGT",  name: "Target",                 kind: "equity" },
  { symbol: "HD",   name: "Home Depot",             kind: "equity" },
  { symbol: "LOW",  name: "Lowe's",                 kind: "equity" },
  { symbol: "NKE",  name: "Nike",                   kind: "equity" },
  { symbol: "LULU", name: "Lululemon",              kind: "equity" },
  { symbol: "SBUX", name: "Starbucks",              kind: "equity" },
  { symbol: "MCD",  name: "McDonald's",             kind: "equity" },
  { symbol: "PG",   name: "Procter & Gamble",       kind: "equity" },
  { symbol: "KO",   name: "Coca-Cola",              kind: "equity" },
  { symbol: "PEP",  name: "PepsiCo",                kind: "equity" },

  // ── Telecoms & media ────────────────────────────────────────────
  { symbol: "T",    name: "AT&T",                   kind: "equity" },
  { symbol: "VZ",   name: "Verizon",                kind: "equity" },
  { symbol: "WBD",  name: "Warner Bros Discovery",  kind: "equity" },

  // ── China ADRs / global tech ────────────────────────────────────
  { symbol: "BABA", name: "Alibaba",                kind: "equity" },
  { symbol: "JD",   name: "JD.com",                 kind: "equity" },
  { symbol: "PDD",  name: "PDD Holdings",           kind: "equity" },
  { symbol: "BIDU", name: "Baidu",                  kind: "equity" },
  { symbol: "NIO",  name: "NIO",                    kind: "equity" },

  // ── Broad index ETFs ────────────────────────────────────────────
  { symbol: "SPY", name: "S&P 500",           kind: "index_etf" },
  { symbol: "QQQ", name: "Nasdaq-100",        kind: "index_etf" },
  { symbol: "DIA", name: "Dow Jones",         kind: "index_etf" },
  { symbol: "IWM", name: "Russell 2000",      kind: "index_etf" },
  { symbol: "VTI", name: "US total market",   kind: "index_etf" },
  { symbol: "VXX", name: "VIX short-term",    kind: "index_etf" },

  // ── Sector ETFs (US) ────────────────────────────────────────────
  { symbol: "XLK",  name: "Tech sector",             kind: "sector_etf" },
  { symbol: "XLF",  name: "Financials sector",       kind: "sector_etf" },
  { symbol: "XLE",  name: "Energy sector",           kind: "sector_etf" },
  { symbol: "XLV",  name: "Healthcare sector",       kind: "sector_etf" },
  { symbol: "XLI",  name: "Industrials sector",      kind: "sector_etf" },
  { symbol: "XLY",  name: "Consumer discretionary",  kind: "sector_etf" },
  { symbol: "XLP",  name: "Consumer staples",        kind: "sector_etf" },
  { symbol: "XLU",  name: "Utilities sector",        kind: "sector_etf" },
  { symbol: "XLB",  name: "Materials sector",        kind: "sector_etf" },
  { symbol: "XLC",  name: "Communication services",  kind: "sector_etf" },
  { symbol: "XLRE", name: "Real estate sector",      kind: "sector_etf" },
  { symbol: "SMH",  name: "Semiconductors",          kind: "sector_etf" },
  { symbol: "SOXX", name: "Semis (iShares)",         kind: "sector_etf" },
  { symbol: "XBI",  name: "Biotech",                 kind: "sector_etf" },
  { symbol: "ITA",  name: "Aerospace & defense",     kind: "sector_etf" },
  { symbol: "KRE",  name: "Regional banks",          kind: "sector_etf" },
  { symbol: "IYT",  name: "Transportation",          kind: "sector_etf" },

  // ── Country / region ETFs ───────────────────────────────────────
  { symbol: "EEM",  name: "Emerging markets",     kind: "region_etf" },
  { symbol: "VWO",  name: "Emerging markets (V)", kind: "region_etf" },
  { symbol: "EFA",  name: "Developed intl",       kind: "region_etf" },
  { symbol: "FXI",  name: "China large-cap",      kind: "region_etf" },
  { symbol: "MCHI", name: "China broad",          kind: "region_etf" },
  { symbol: "KWEB", name: "China internet",       kind: "region_etf" },
  { symbol: "INDA", name: "India",                kind: "region_etf" },
  { symbol: "EWJ",  name: "Japan",                kind: "region_etf" },
  { symbol: "EWG",  name: "Germany",              kind: "region_etf" },
  { symbol: "EWU",  name: "United Kingdom",       kind: "region_etf" },
  { symbol: "EWZ",  name: "Brazil",               kind: "region_etf" },
  { symbol: "EWT",  name: "Taiwan",               kind: "region_etf" },
  { symbol: "EWY",  name: "South Korea",          kind: "region_etf" },
  { symbol: "FEZ",  name: "Eurozone",             kind: "region_etf" },
  { symbol: "ILF",  name: "Latin America",        kind: "region_etf" },
  { symbol: "EIS",  name: "Israel",               kind: "region_etf" },
  { symbol: "TUR",  name: "Turkey",               kind: "region_etf" },

  // ── Commodities (ETF proxies) ───────────────────────────────────
  { symbol: "USO",  name: "US oil",           kind: "commodity" },
  { symbol: "UNG",  name: "Natural gas",      kind: "commodity" },
  { symbol: "GLD",  name: "Gold",             kind: "commodity" },
  { symbol: "SLV",  name: "Silver",           kind: "commodity" },
  { symbol: "CPER", name: "Copper",           kind: "commodity" },
  { symbol: "WEAT", name: "Wheat",            kind: "commodity" },
  { symbol: "CORN", name: "Corn",             kind: "commodity" },
  { symbol: "DBA",  name: "Agriculture",      kind: "commodity" },
  { symbol: "GDX",  name: "Gold miners",      kind: "commodity" },
  { symbol: "URA",  name: "Uranium",          kind: "commodity" },
  { symbol: "LIT",  name: "Lithium",          kind: "commodity" },

  // ── FX (ETF proxies) ────────────────────────────────────────────
  { symbol: "UUP", name: "US dollar",   kind: "fx" },
  { symbol: "FXE", name: "Euro",        kind: "fx" },
  { symbol: "FXY", name: "Japanese yen", kind: "fx" },
  { symbol: "FXB", name: "British pound", kind: "fx" },
  { symbol: "CYB", name: "Chinese yuan", kind: "fx" },
  { symbol: "FXC", name: "Canadian dollar", kind: "fx" },

  // ── Rates & bonds ───────────────────────────────────────────────
  { symbol: "TLT", name: "20+ year Treasuries", kind: "rates" },
  { symbol: "IEF", name: "7-10 year Treasuries", kind: "rates" },
  { symbol: "SHY", name: "1-3 year Treasuries",  kind: "rates" },
  { symbol: "HYG", name: "High-yield bonds",     kind: "rates" },
  { symbol: "LQD", name: "Investment-grade bonds", kind: "rates" },
  { symbol: "TIP", name: "TIPS (inflation-protected)", kind: "rates" },

  // ── Crypto ──────────────────────────────────────────────────────
  { symbol: "IBIT", name: "Bitcoin ETF (BlackRock)", kind: "crypto" },
  { symbol: "FBTC", name: "Bitcoin ETF (Fidelity)",  kind: "crypto" },
  { symbol: "ETHE", name: "Ethereum trust",          kind: "crypto" },
];

// Fast lookup — used to validate LLM output.
export const TICKER_SET: Set<string> = new Set(
  TICKER_WHITELIST.map((t) => t.symbol)
);

export function findTicker(symbol: string): Ticker | undefined {
  return TICKER_WHITELIST.find((t) => t.symbol === symbol);
}

// Compact "SYMBOL (Name, kind)" list for the classifier prompt. Kept lean —
// the classifier only needs the symbol + a short label to pick from.
export function formatWhitelistForPrompt(): string {
  return TICKER_WHITELIST
    .map((t) => `${t.symbol} — ${t.name}`)
    .join("\n");
}
