import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getOrCreateUser } from "./start.js";
import { fetchPrices, type PriceResult } from "../price-api.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("view_watchlist", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const profile = await getOrCreateUser(userId);
  const tickers = Object.keys(profile.watchlist);

  if (tickers.length === 0) {
    await ctx.reply("No coins on your watchlist yet — tap ➕ Add Bitcoin to start.", {
      reply_markup: inlineKeyboard([
        [inlineButton("➕ Add Bitcoin", "add_ticker:BTC")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  const prices = await fetchPrices(tickers);
  const priceMap = new Map<string, PriceResult>();
  for (const p of prices) {
    if ("price" in p) priceMap.set(p.ticker, p);
  }

  const lines: string[] = ["📋 Your watchlist:\n"];
  for (const ticker of tickers) {
    const p = priceMap.get(ticker);
    if (p) {
      const changeStr =
        p.change24h !== null
          ? ` (${p.change24h >= 0 ? "+" : ""}${p.change24h.toFixed(2)}%)`
          : "";
      lines.push(`• ${ticker}: $${formatPrice(p.price)}${changeStr}`);
    } else {
      lines.push(`• ${ticker}: price unavailable`);
    }
  }

  const buttons: ReturnType<typeof inlineButton>[][] = tickers.map((t) => [
    inlineButton(`🗑 Remove ${t}`, `remove_ticker:${t}`),
  ]);
  buttons.push([inlineButton("➕ Add more", "add_ticker:BTC")]);
  buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.reply(lines.join("\n"), {
    reply_markup: inlineKeyboard(buttons),
  });
});

composer.callbackQuery(/^remove_ticker:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  const ticker = ctx.match?.[1];
  if (!userId || !ticker) return;

  const profile = await getOrCreateUser(userId);
  if (!profile.watchlist[ticker]) {
    await ctx.reply(`${ticker} is not on your watchlist.`);
    return;
  }

  delete profile.watchlist[ticker];
  const { storeSet } = await import("../storage.js");
  await storeSet(`user:${userId}`, profile);

  await ctx.reply(`✅ ${ticker} removed from your watchlist.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

function formatPrice(price: number): string {
  if (price >= 1) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(8);
}

export default composer;
