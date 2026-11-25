import {
  createRootRoute,
  Outlet,
  Scripts,
  HeadContent,
  Link,
} from '@tanstack/react-router';
import { Nav, Footer } from '~/components/Chrome';

const RootRoute = createRootRoute({
  head: () => (
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="theme-color" content="#04060b" />
      <HeadContent />
      <title>Nakshatra Canvas · Your Birth Chart as Living Art</title>
      <meta name="description" content="Generate your Vedic birth chart wallpaper. Nakshatra, lagna, planetary positions, dashas, and AI-powered readings." />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    </>
  ),
  component: () => (
    <html lang="en" className="scroll-smooth">
      <body className="grain vignette min-h-screen bg-void text-bone font-body antialiased">
        <div className="letterbox letterbox-top" aria-hidden="true" />
        <div className="letterbox letterbox-bottom" aria-hidden="true" />

        <Nav />

        <main id="main-content" className="relative z-10 pt-16 pb-24 md:pt-20 md:pb-32">
          <Outlet />
        </main>

        <Footer />

        <Scripts />
      </body>
    </html>
  ),
});

export const Route = RootRoute;