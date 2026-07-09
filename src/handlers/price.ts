import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getOrCreateUser } from "./start.js";
import { fetchPrices, fetchPrice } from "../price-api.js";
import type { PriceResult } from "../price-api.js";

const composer = new Composer<Ctx>();

composer.command("price", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("Add some coins to your watchlist first, then check prices.", {
      reply_markup: inlineKeyboard([
        [inlineButton("➕ Add Bitcoin", "add_ticker:BTC")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }
  await sendPriceList(ctx, userId);
});

composer.callbackQuery("price:all", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("Add some coins to your watchlist first.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }
  await sendPriceList(ctx, userId);
});

composer.callbackQuery(/^price:(?!all$)(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const ticker = ctx.match?.[1];
  if (!ticker) return;

  const result = await fetchPrice(ticker);
  if (!result) {
    await ctx.reply(`Couldn't fetch the price for ${ticker}. Check the ticker symbol and try again.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  const changeStr =
    result.change24h !== null
      ? ` (24h: ${result.change24h >= 0 ? "+" : ""}${result.change24h.toFixed(2)}%)`
      : "";

  await ctx.reply(`💰 ${result.ticker}: $${formatPrice(result.price)}${changeStr}`, {
    reply_markup: inlineKeyboard([
      [inlineButton("🔄 Refresh", `price:${result.ticker}`)],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

async function sendPriceList(ctx: Ctx, userId: number) {
  const profile = await getOrCreateUser(userId);
  const tickers = Object.keys(profile.watchlist);

  if (tickers.length === 0) {
    await ctx.reply("Your watchlist is empty — add some coins to track prices.", {
      reply_markup: inlineKeyboard([
        [inlineButton("➕ Add Bitcoin", "add_ticker:BTC")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  const prices = await fetchPrices(tickers);
  const lines: string[] = ["💰 Current prices:\n"];
  const buttons: ReturnType<typeof inlineButton>[][] = [];

  for (const result of prices) {
    if ("price" in result) {
      const changeStr =
        result.change24h !== null
          ? ` (${result.change24h >= 0 ? "+" : ""}${result.change24h.toFixed(2)}%)`
          : "";
      lines.push(`• ${result.ticker}: $${formatPrice(result.price)}${changeStr}`);
      buttons.push([inlineButton(`🔔 Alert ${result.ticker}`, `set_threshold:${result.ticker}`)]);
    } else {
      lines.push(`• ${result.ticker}: ${result.error}`);
    }
  }

  buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.reply(lines.join("\n"), {
    reply_markup: inlineKeyboard(buttons),
  });
}

function formatPrice(price: number): string {
  if (price >= 1) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(8);
}

export default composer;
