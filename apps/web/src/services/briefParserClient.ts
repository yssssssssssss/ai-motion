import { createFallbackBriefIntent, type BriefParseResult } from "@motion-tool/core";

// 简单 LRU：相同 brief 只调一次 LLM，避免重复算力消耗
const CACHE_CAPACITY = 32;
const cache = new Map<string, BriefParseResult>();

function readCache(key: string): BriefParseResult | undefined {
  const value = cache.get(key);
  if (!value) return undefined;
  // 命中：移到末尾，保持 LRU 顺序
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function writeCache(key: string, value: BriefParseResult): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > CACHE_CAPACITY) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

// 仅用于测试 / 重置
export function clearBriefParserCache(): void {
  cache.clear();
}

export async function parseBrief(brief: string): Promise<BriefParseResult> {
  const trimmed = brief.trim();
  if (!trimmed) {
    return {
      mode: "fallback",
      intent: createFallbackBriefIntent(""),
      message: "请输入需求以生成智能推荐。"
    };
  }

  const cached = readCache(trimmed);
  if (cached) return cached;

  try {
    const response = await fetch("/api/brief/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: trimmed })
    });

    if (!response.ok) throw new Error(`Brief parser failed: ${response.status}`);
    const result = (await response.json()) as BriefParseResult;
    writeCache(trimmed, result);
    return result;
  } catch {
    const fallback: BriefParseResult = {
      mode: "fallback",
      intent: createFallbackBriefIntent(trimmed),
      message: "已使用本地匹配。"
    };
    // 也缓存 fallback，但 TTL 短一些——这里简单化处理直接缓存
    writeCache(trimmed, fallback);
    return fallback;
  }
}
