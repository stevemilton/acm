import { NextResponse } from "next/server";

/**
 * Cron endpoint — runs all indexers and monitors in sequence.
 *
 * GET  /api/cron?key=<INDEXER_SECRET>  (for external cron services)
 * POST /api/cron  (with x-indexer-key header)
 *
 * Calls in order:
 * 1. /api/indexer           — sync on-chain escrow/share state
 * 2. /api/indexer/events    — process escrow + revenue distribution events
 * 3. /api/monitor/revenue   — watch FDUSD transfers to agent wallets
 */

function getBaseUrl(): string {
  // In production, use the app's own URL
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  return "http://localhost:3000";
}

function checkAuth(request: Request): boolean {
  const secret = process.env.INDEXER_SECRET;
  if (!secret) return true;

  // Check header (for POST)
  const header = request.headers.get("x-indexer-key");
  if (header === secret) return true;

  // Check query param (for GET from external cron services)
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  return key === secret;
}

async function callEndpoint(
  baseUrl: string,
  path: string,
  secret: string | undefined
): Promise<{ path: string; ok: boolean; data?: unknown; error?: string }> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "x-indexer-key": secret } : {}),
      },
    });

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      const text = await res.text();
      return {
        path,
        ok: false,
        error: `Non-JSON response (${res.status}): ${text.slice(0, 200)}`,
      };
    }

    const data = await res.json();
    return { path, ok: res.ok, data };
  } catch (err) {
    return {
      path,
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function runCron() {
  const baseUrl = getBaseUrl();
  const secret = process.env.INDEXER_SECRET;
  const startTime = Date.now();

  const results = [];

  // Run sequentially to avoid overwhelming the RPC
  for (const path of [
    "/api/indexer",
    "/api/indexer/events",
    "/api/monitor/revenue",
  ]) {
    const result = await callEndpoint(baseUrl, path, secret);
    results.push(result);
  }

  return {
    duration_ms: Date.now() - startTime,
    timestamp: new Date().toISOString(),
    results,
  };
}

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await runCron();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await runCron();
  return NextResponse.json(data);
}
