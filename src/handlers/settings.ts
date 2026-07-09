import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getOrCreateUser } from "./start.js";
import { storeSet } from "../storage.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("settings:menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const profile = await getOrCreateUser(userId);
  const summaryTime = profile.morning_summary_time;

  const lines: string[] = ["⚙️ Settings:"];
  lines.push(`Morning summary: ${summaryTime ? `${summaryTime} daily` : "off"}`);

  const buttons: ReturnType<typeof inlineButton>[][] = [
    [inlineButton(summaryTime ? "✏️ Change summary time" : "⏰ Set summary time", "settings:summary:set")],
  ];
  if (summaryTime) {
    buttons.push([inlineButton("🚫 Disable summary", "settings:summary:disable")]);
  }
  buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.reply(lines.join("\n"), {
    reply_markup: inlineKeyboard(buttons),
  });
});

composer.callbackQuery("settings:summary:set", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const profile = await getOrCreateUser(userId);
  profile.step = "awaiting_summary_time";
  await storeSet(`user:${userId}`, profile);

  await ctx.reply("What time should the daily summary arrive? Enter a time like 08:00 or 8am.");
});

composer.callbackQuery("settings:summary:disable", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const profile = await getOrCreateUser(userId);
  profile.morning_summary_time = null;
  profile.step = undefined;
  await storeSet(`user:${userId}`, profile);

  await ctx.reply("✅ Morning summary disabled.", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.on("message:text", async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return next();

  const profile = await getOrCreateUser(userId);

  if (profile.step === "awaiting_summary_time") {
    const time = parseTime(ctx.message.text.trim());
    if (!time) {
      await ctx.reply("That doesn't look like a valid time. Try something like 08:00 or 8am.");
      return;
    }

    profile.morning_summary_time = time;
    profile.step = undefined;
    await storeSet(`user:${userId}`, profile);

    await ctx.reply(`✅ Morning summary set for ${time} daily. You'll get a price digest each morning.`, {
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
