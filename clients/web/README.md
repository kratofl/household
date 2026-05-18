# Household Web

Next.js 16 App Router UI for the Household local-network app.

## Stack

- Next.js 16.2.6
- React 19.2.6
- Tailwind CSS 4
- shadcn/ui preset `b6FAZ7jW6a`

## Commands

```bash
npm run dev
npm run lint
npm run build
```

The UI proxies backend calls through `src/app/api/backend/[...path]/route.ts`.

Default backend target:

```bash
http://localhost:8090/api/v1
```

Override when needed:

```bash
HOUSEHOLD_API_URL=http://<api-host>:8090/api/v1 npm run dev
```

## Current UI

- Login with Identity access/refresh tokens.
- User registration request. New users remain pending until approved by an admin.
- Password change for logged-in users.
- Active slice navigation.
- Admin slice toggles backed by Identity modules.
