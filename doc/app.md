# app Package

## Overview
Next.js App Router structure with pages, layouts, and API routes.

## Sub-Packages

- **[api/](app-api.md)** - API endpoints (19 routes)
- **[pages](app-pages.md)** - User-facing pages (8 pages)

## Structure

**Root:**
- layout.tsx - Root layout with navigation
- page.tsx - Redirects to /home or /login
- globals.css - Global styles

**Pattern:**
Each page: `page.tsx` (server auth check) → `PageClient.tsx` (UI + state + hooks)

## API Routes
Authentication, game state, game actions, research, factory, admin - see [app-api.md](app-api.md)

## Pages
home, game, research, factory, profile, about, login, admin - see [app-pages.md](app-pages.md)
