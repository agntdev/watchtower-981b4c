import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getOrCreateUser } from "./start.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("add_ticker:BTC", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const profile = await getOrCreateUser(userId);
  if (profile.watchlist["BTC"]) {
    await ctx.reply("BTC is already on your watchlist.", {
      reply_markup: inlineKeyboard([
        [inlineButton("📋 View watchlist", "view_watchlist")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  profile.watchlist["BTC"] = { added_at: Date.now() };
  const { storeSet } = await import("../storage.js");
  await storeSet(`user:${userId}`, profile);

  await ctx.reply("✅ BTC added to your watchlist with default settings.", {
    reply_markup: inlineKeyboard([
      [inlineButton("💰 Check price", "price:BTC")],
      [inlineButton("🔔 Set alert", "set_threshold:BTC")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

export default composer;
