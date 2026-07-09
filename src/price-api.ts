/**
 * CoinGecko price API client. Free tier, no API key required.
 * Endpoints used:
 *   GET /simple/price?ids={ids}&vs_currencies=usd&include_24hr_change=true
 *
 * CoinGecko ids map:
 *   BTC → bitcoin, ETH → ethereum, SOL → solana, ADA → cardano,
 *   XRP → ripple, DOT → polkadot, DOGE → dogecoin, AVAX → avalanche-2,
 *   LINK → chainlink, MATIC → polygon-pos
 */

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

const TICKER_TO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  XRP: "ripple",
  DOT: "polkadot",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  MATIC: "polygon-pos",
};

export interface PriceResult {
  ticker: string;
  price: number;
  change24h: number | null;
}

export interface PriceApiError {
  ticker: string;
  error: string;
}

function tickerToId(ticker: string): string | null {
  return TICKER_TO_ID[ticker.toUpperCase()] ?? null;
}

/**
 * Fetch current USD price for a single ticker.
 * Returns null if the ticker is unknown or the API call fails.
 */
export async function fetchPrice(ticker: string): Promise<PriceResult | null> {
  const id = tickerToId(ticker);
  if (!id) return null;
  try {
    const url = `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<
      string,
      { usd?: number; usd_24h_change?: number }
    >;
    const entry = data[id];
    if (!entry || entry.usd === undefined) return null;
    return {
      ticker: ticker.toUpperCase(),
      price: entry.usd,
      change24h: entry.usd_24h_change ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch current USD prices for multiple tickers in one API call.
 * CoinGecko allows comma-separated ids, so we batch them.
 * Returns results for each ticker (null for unknown/failed).
 */
export async function fetchPrices(
  tickers: string[],
): Promise<(PriceResult | PriceApiError)[]> {
  if (tickers.length === 0) return [];

  const ids = tickers
    .map((t) => tickerToId(t))
    .filter((id): id is string => id !== null);

  if (ids.length === 0) {
    return tickers.map((t) => ({ ticker: t.toUpperCase(), error: "Unknown ticker" }));
  }

  try {
    const url = `${COINGECKO_BASE}/simple/price?ids=${ids.map(encodeURIComponent).join(",")}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return tickers.map((t) => ({
        ticker: t.toUpperCase(),
        error: "API error",
      }));
    }
    const data = (await res.json()) as Record<
      string,
      { usd?: number; usd_24h_change?: number }
    >;

    const results: (PriceResult | PriceApiError)[] = [];
    const idToTicker = new Map<string, string>();
    for (const t of tickers) {
      const id = tickerToId(t);
      if (id) idToTicker.set(id, t.toUpperCase());
    }

    for (const t of tickers) {
      const id = tickerToId(t);
      if (!id) {
        results.push({ ticker: t.toUpperCase(), error: "Unknown ticker" });
        continue;
      }
      const entry = data[id];
      if (!entry || entry.usd === undefined) {
        results.push({ ticker: t.toUpperCase(), error: "No data" });
        continue;
      }
      results.push({
        ticker: t.toUpperCase(),
        price: entry.usd,
        change24h: entry.usd_24h_change ?? null,
      });
    }

    return results;
  } catch {
    return tickers.map((t) => ({
      ticker: t.toUpperCase(),
      error: "Network error",
    }));
  }
}
