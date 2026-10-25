import * as Sentry from "@sentry/nextjs";

export function register() {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 1.0,
      debug: process.env.NODE_ENV === "development",
      replaysOnErrorSampleRate: 1.0,
      replaysSampleRate: 0.1,
      integrations: [
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      // Custom tags for Nakshatra Canvas
      initialScope: {
        tags: {
          app: "nakshatra-canvas",
        },
      },
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
