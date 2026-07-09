import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  mainMenuKeyboard,
  registerMainMenuItem,
  inlineButton,
  inlineKeyboard,
} from "../toolkit/index.js";
import { storeGet, storeSet } from "../storage.js";

registerMainMenuItem({ label: "➕ Add Bitcoin", data: "add_ticker:BTC", order: 10 });
registerMainMenuItem({ label: "📋 View list", data: "view_watchlist", order: 20 });
registerMainMenuItem({ label: "💰 Price", data: "price:all", order: 30 });
registerMainMenuItem({ label: "🔔 Alerts", data: "alerts:menu", order: 40 });
registerMainMenuItem({ label: "🌙 Quiet hours", data: "quiet:menu", order: 50 });
registerMainMenuItem({ label: "⚙️ Settings", data: "settings:menu", order: 60 });

const WELCOME = "👋 Welcome! Tap a button below to get started.";

export interface AlertConfig {
  id: string;
  ticker: string;
  direction: "above" | "below";
  target_price: number;
  created_at: number;
}

export interface UserProfile {
  telegram_id: number;
  watchlist: Record<string, { added_at: number }>;
  alerts: Record<string, AlertConfig>;
  quiet_hours: { start: string; end: string } | null;
  morning_summary_time: string | null;
  cooldown_state: Record<string, number>;
  step?: string;
  alertTicker?: string;
  alertDirection?: "above" | "below";
  quietStart?: string;
  quietEnd?: string;
}

function userKey(userId: number): string {
  return `user:${userId}`;
}

export async function getOrCreateUser(userId: number): Promise<UserProfile> {
  const existing = await storeGet<UserProfile>(userKey(userId));
  if (existing) return existing;
  const profile: UserProfile = {
    telegram_id: userId,
    watchlist: {},
    alerts: {},
    quiet_hours: null,
    morning_summary_time: null,
    cooldown_state: {},
  };
  await storeSet(userKey(userId), profile);
  return profile;
}

const composer = new Composer<Ctx>();

composer.command("start", async (ctx) => {
  const userId = ctx.from?.id;
  if (userId) await getOrCreateUser(userId);
  await ctx.reply(WELCOME, { reply_markup: mainMenuKeyboard() });
});

composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(WELCOME, { reply_markup: mainMenuKeyboard() });
});

export default composer;
