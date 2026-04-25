@AGENTS.md

## Auth & Routing

- `src/proxy.ts` acts as **Next.js middleware** (exports `config` with `matcher`). It redirects unauthenticated users to `/login` for any route not in its public allowlist.
- When adding new public pages (pages accessible without login), you **must** add the path to the allowlist in `src/proxy.ts` or the route will 307 redirect to `/login`.
- Current public routes: `/login`, `/invite`, `/reset-password`, `/api/*`, `/_next/*`

## Third-Party APIs

- Before planning or writing any code that integrates with a third-party API, **always** fetch the latest official documentation from the web first. APIs change frequently — do not rely on training data or cached knowledge for endpoints, auth flows, request/response shapes, or SDK usage.
