import { createFileRoute } from "@tanstack/react-router";

const ALLOWED = [
  "/api/v5/market/ticker",
  "/api/v5/market/candles",
  "/api/v5/market/books",
  "/api/v5/market/index-tickers",
  "/api/v5/public/funding-rate",
  "/api/v5/public/open-interest",
  "/api/v5/public/mark-price",
  "/api/v5/rubik/stat/contracts/long-short-account-ratio",
  "/api/v5/rubik/stat/taker-volume",
];

export const Route = createFileRoute("/api/okx")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get("path") || "";
        if (!ALLOWED.includes(path)) {
          return Response.json({ error: "path not allowed" }, { status: 400 });
        }
        const fwd = new URLSearchParams();
        url.searchParams.forEach((v, k) => {
          if (k !== "path") fwd.set(k, v);
        });
        const target = `https://www.okx.com${path}?${fwd.toString()}`;
        try {
          const r = await fetch(target, {
            headers: { accept: "application/json" },
            cache: "no-store",
          });
          const body = await r.text();
          return new Response(body, {
            status: r.status,
            headers: {
              "content-type": r.headers.get("content-type") || "application/json",
              "cache-control": "no-store",
            },
          });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "upstream failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});
