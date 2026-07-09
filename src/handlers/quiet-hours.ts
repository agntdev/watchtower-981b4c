import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getOrCreateUser } from "./start.js";
import { storeSet } from "../storage.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("quiet:menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const profile = await getOrCreateUser(userId);
  const qh = profile.quiet_hours;

  if (qh) {
    await ctx.reply(`🌙 Quiet hours: ${qh.start} – ${qh.end}\nAlerts during this window are deferred until it ends.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("✏️ Change hours", "quiet:set")],
        [inlineButton("🚫 Disable", "quiet:disable")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
  } else {
    await ctx.reply("🌙 Quiet hours are off. Set a window to pause alerts while you sleep.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⏰ Set quiet hours", "quiet:set")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
  }
});

composer.callbackQuery("quiet:set", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const profile = await getOrCreateUser(userId);
  profile.step = "awaiting_quiet_start";
  await storeSet(`user:${userId}`, profile);

  await ctx.reply("When should quiet hours start? Enter a time like 22:00 or 10pm.");
});

composer.callbackQuery("quiet:disable", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const profile = await getOrCreateUser(userId);
  profile.quiet_hours = null;
  profile.step = undefined;
  await storeSet(`user:${userId}`, profile);

  await ctx.reply("✅ Quiet hours disabled. Alerts will fire anytime.", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.on("message:text", async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return next();

  const profile = await getOrCreateUser(userId);

  if (profile.step === "awaiting_quiet_start") {
    const time = parseTime(ctx.message.text.trim());
    if (!time) {
      await ctx.reply("That doesn't look like a valid time. Try something like 22:00 or 10pm.");
      return;
    }
    profile.quietStart = time;
    profile.step = "awaiting_quiet_end";
    await storeSet(`user:${userId}`, profile);

    await ctx.reply(`Got it — quiet hours start at ${time}. When should they end?`);
    return;
  }

  if (profile.step === "awaiting_quiet_end") {
    const time = parseTime(ctx.message.text.trim());
    if (!time) {
      await ctx.reply("That doesn't look like a valid time. Try something like 07:00 or 7am.");
      return;
    }
    profile.quietEnd = time;
    profile.quiet_hours = { start: profile.quietStart!, end: time };
    profile.step = undefined;
    profile.quietStart = undefined;
    profile.quietEnd = undefined;
    await storeSet(`user:${userId}`, profile);

    await ctx.reply(`✅ Quiet hours set: ${profile.quiet_hours.start} – ${time}. Alerts will be deferred during this window.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  return next();
});

function parseTime(input: string): string | null {
  const s = input.trim().toLowerCase();

  const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2] ? parseInt(ampm[2], 10) : 0;
    if (h < 1 || h > 12 || m < 0 || m > 59) return null;
    if (ampm[3] === "am" && h === 12) h = 0;
    if (ampm[3] === "pm" && h !== 12) h += 12;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  const mil = s.match(/^(\d{1,2}):(\d{2})$/);
  if (mil) {
    const h = parseInt(mil[1], 10);
    const m = parseInt(mil[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  return null;
}

export default composer;
