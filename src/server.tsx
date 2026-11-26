import {
  createStartHandler,
  defaultStreamHandler,
  createServerEntry as createCoreServerEntry,
} from "@tanstack/react-start/server";
import type { Register } from "@tanstack/react-router";
import type { RequestHandler } from "@tanstack/react-start/server";
import { StartServer } from "@tanstack/react-start/server";
import { renderRouterToStream } from "@tanstack/react-router/ssr/server";
import { defineHandlerCallback } from "@tanstack/router-core/ssr/server";
import { env as cloudflareEnv } from "cloudflare:workers";
import { processWallpaperJob } from "~/server/queue-consumer";
import { JobsDurableObject } from "~/server/jobs-do";
import { syncEnv, type WorkerEnv } from "~/server/env-sync";

const fetch = createStartHandler(
  defineHandlerCallback(async ({ request, router, responseHeaders }) => {
    syncEnv((cloudflareEnv ?? {}) as unknown as WorkerEnv);
    const url = new URL(request.url);
    const pathname = url.pathname;

    const isApiRoute = pathname.startsWith("/api/");

    if (!isApiRoute) {
      try {
        await router.load({ _signal: request.signal, _skipLocationUpdate: true });
        const matches = router.state.matches;
        if (matches.length > 0) {
          const matchedRoute = matches[matches.length - 1];
          const route = router.routesById[matchedRoute.routeId];

          if (route?.server?.handlers?.[request.method as keyof typeof route.server.handlers]) {
            const handler = route.server.handlers[request.method as keyof typeof route.server.handlers];
            return handler({ request, router, responseHeaders });
          }
        }
      } catch (e) {
      }
    }

    let routeId = pathname;
    if (pathname.startsWith("/api/auth/") || pathname === "/api/preview") {
      routeId = pathname;
    }
    const route = router.routesById[routeId];
    if (route?.server?.handlers?.[request.method as keyof typeof route.server.handlers]) {
      const handler = route.server.handlers[request.method as keyof typeof route.server.handlers];
      return handler({ request, router, responseHeaders });
    }

    return renderRouterToStream({
      request,
      router,
      responseHeaders,
      children: <StartServer router={router} />,
    });
  })
);

export type ServerEntry = { fetch: RequestHandler<Register> };
export const createServerEntry: (entry: ServerEntry) => ServerEntry =
  createCoreServerEntry<Register>;

export { processWallpaperJob, JobsDurableObject };

export default createServerEntry({ fetch });
