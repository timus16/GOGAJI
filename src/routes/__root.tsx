import {
  createRootRoute,
  Outlet,
  Scripts,
  HeadContent,
  Link,
} from '@tanstack/react-router';
import appCss from '~/styles/app.css?url';
import { Nav, Footer } from '~/components/Chrome';

const RootRoute = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#04060b' },
      { title: 'Nakshatra Canvas · Your Birth Chart as Living Art' },
      {
        name: 'description',
        content:
          'Generate your Vedic birth chart wallpaper. Nakshatra, lagna, planetary positions, dashas, and AI-powered readings.',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
    ],
  }),
  component: () => (
    <html lang="en" className="scroll-smooth">
      <head>
        <HeadContent />
      </head>
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
