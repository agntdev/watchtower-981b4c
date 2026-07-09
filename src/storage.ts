/**
 * Durable data storage — Redis-backed via ioredis (when REDIS_URL is set),
 * in-memory fallback for dev / test harness. NO keyspace scans; every read
 * goes through an explicit key.
 */

import { createRequire } from "node:module";

let redisClient: { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<unknown>; del(k: string): Promise<unknown> } | null = null;
let redisChecked = false;
const mem = new Map<string, string>();

function getRedis() {
  if (redisChecked) return redisClient;
  redisChecked = true;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IORedis = require("ioredis") as new (url: string, opts?: Record<string, unknown>) => { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<unknown>; del(k: string): Promise<unknown> };
    redisClient = new IORedis(url, { maxRetriesPerRequest: null, lazyConnect: false });
    return redisClient;
  } catch {
    return null;
  }
}

export async function storeGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (r) {
    const raw = await r.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  const raw = mem.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function storeSet<T>(key: string, value: T): Promise<void> {
  const json = JSON.stringify(value);
  const r = getRedis();
  if (r) {
    await r.set(key, json);
  } else {
    mem.set(key, json);
  }
}

export async function storeDel(key: string): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.del(key);
  } else {
    mem.delete(key);
  }
}

export async function storeKeys(pattern: string): Promise<string[]> {
  const r = getRedis();
  if (r && "keys" in r) {
    return await (r as { keys(p: string): Promise<string[]> }).keys(pattern);
  }
  const regex = new RegExp(
    "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
  );
  return [...mem.keys()].filter((k) => regex.test(k));
}

export function _clearStorage(): void {
  mem.clear();
}
