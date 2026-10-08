import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

export { ClubStore } from "../lib/club-store";

export default {
  async scheduled(_controller: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext) {
    const store = env.CLUB_STORE.get(env.CLUB_STORE.idFromName("leo-xi"));
    const tasks: Promise<unknown>[] = [store.fetch("https://club.internal/internal/sync").then(async response => { if (!response.ok) throw new Error("Club sync failed"); await response.arrayBuffer(); })];

    ctx.waitUntil(Promise.all(tasks));
  },
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const path = new URL(request.url).pathname;
    if (["/api/club", "/api/archive", "/api/attendance"].includes(path)) {
      if (!env.CLUB_STORE) return Response.json({error:"Kalıcı kulüp deposu henüz bağlanmadı."},{status:503});
      if (request.method === "POST" && request.headers.get("Origin") !== new URL(request.url).origin) return Response.json({error:"Geçersiz kaynak."},{status:403});
      const store = env.CLUB_STORE.get(env.CLUB_STORE.idFromName("leo-xi"));
      return store.fetch(request);
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};
