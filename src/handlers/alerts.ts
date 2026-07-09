import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getOrCreateUser } from "./start.js";
import { storeSet } from "../storage.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("alerts:menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const profile = await getOrCreateUser(userId);
  const alertEntries = Object.values(profile.alerts);

  if (alertEntries.length === 0) {
    await ctx.reply("No alerts set yet. Add a coin to your watchlist, then tap 🔔 to set an alert.", {
      reply_markup: inlineKeyboard([
        [inlineButton("➕ Add Bitcoin", "add_ticker:BTC")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  const lines: string[] = ["🔔 Your alerts:\n"];
  for (const alert of alertEntries) {
    const dir = alert.direction === "above" ? "above" : "below";
    lines.push(`• ${alert.ticker}: alert when ${dir} $${formatPrice(alert.target_price)}`);
  }

  const buttons: ReturnType<typeof inlineButton>[][] = alertEntries.map((a) => [
    inlineButton(`🗑 Remove ${a.ticker} alert`, `remove_alert:${a.id}`),
  ]);
  buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.reply(lines.join("\n"), {
    reply_markup: inlineKeyboard(buttons),
  });
});

composer.callbackQuery(/^set_threshold:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  const ticker = ctx.match?.[1];
  if (!userId || !ticker) return;

  const profile = await getOrCreateUser(userId);
  if (!profile.watchlist[ticker]) {
    await ctx.reply(`${ticker} is not on your watchlist. Add it first.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  profile.step = "awaiting_alert_direction";
  profile.alertTicker = ticker;
  await storeSet(`user:${userId}`, profile);

  await ctx.reply(`Set an alert for ${ticker}. Should I alert you when the price goes above or below a target?`, {
    reply_markup: inlineKeyboard([
      [inlineButton("📈 Above", `alert_dir:${ticker}:above`)],
      [inlineButton("📉 Below", `alert_dir:${ticker}:below`)],
      [inlineButton("Cancel", "menu:main")],
    ]),
  });
});

composer.callbackQuery(/^alert_dir:(.+):(above|below)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  const ticker = ctx.match?.[1];
  const direction = ctx.match?.[2] as "above" | "below";
  if (!userId || !ticker || !direction) return;

  const profile = await getOrCreateUser(userId);
  profile.step = "awaiting_alert_price";
  profile.alertTicker = ticker;
  profile.alertDirection = direction;
  await storeSet(`user:${userId}`, profile);

  const dirLabel = direction === "above" ? "above" : "below";
  await ctx.reply(`Got it — alert when ${ticker} goes ${dirLabel} a target price. What price should I watch for?`);
});

composer.on("message:text", async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return next();

  const profile = await getOrCreateUser(userId);
  if (profile.step === "awaiting_alert_price") {
    const text = ctx.message.text.trim();
    const price = parseFloat(text.replace(/[$,]/g, ""));
    if (isNaN(price) || price <= 0) {
      await ctx.reply("That doesn't look like a valid price. Enter a number like 50000 or 0.50.");
      return;
    }

    const ticker = profile.alertTicker!;
    const direction = profile.alertDirection!;
    const alertId = `${ticker}_${direction}_${price}_${Date.now()}`;

    profile.alerts[alertId] = {
      id: alertId,
      ticker,
      direction,
      target_price: price,
      created_at: Date.now(),
    };
    profile.step = undefined;
    profile.alertTicker = undefined;
    profile.alertDirection = undefined;
    await storeSet(`user:${userId}`, profile);

    const dirLabel = direction === "above" ? "above" : "below";
    await ctx.reply(`✅ Alert set: ${ticker} ${dirLabel} $${formatPrice(price)}`, {
      reply_markup: inlineKeyboard([
        [inlineButton("🔔 Set another alert", `set_threshold:${ticker}`)],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  return next();
});

composer.callbackQuery(/^remove_alert:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  const alertId = ctx.match?.[1];
  if (!userId || !alertId) return;

  const profile = await getOrCreateUser(userId);
  if (!profile.alerts[alertId]) {
    await ctx.reply("That alert doesn't exist anymore.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  delete profile.alerts[alertId];
  await storeSet(`user:${userId}`, profile);

  await ctx.reply("✅ Alert removed.", {
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
