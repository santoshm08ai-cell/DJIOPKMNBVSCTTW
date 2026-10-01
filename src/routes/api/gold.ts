import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/gold")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const r = await fetch("https://api.gold-api.com/price/XAU", {
            headers: { accept: "application/json" },
            cache: "no-store",
          });
          const body = await r.text();
          return new Response(body, {
            status: r.status,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
            },
          });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "gold feed failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});
