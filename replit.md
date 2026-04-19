# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (not provisioned — app uses external APIs)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Project: AI Travel Planner India

### Purpose
A full-stack AI travel planning web application for all places in India. Users enter trip details and get a comprehensive travel plan with places, transport, hotels, food, itinerary, budget breakdown, and a Google Maps embed.

### User Inputs
- Source location (Indian city)
- Destination location (Indian city)
- Number of days
- Number of people
- Budget (INR)
- Budget type: Total or Per Person

### Features
- **Dynamic places**: Fetches attractions from Overpass API using OpenStreetMap coordinates (Nominatim). Falls back to curated lists for popular destinations.
- **Transport options**: Bus, Train, Flight, Car with cost, duration, and best-option recommendation
- **Budget breakdown**: Dynamic allocation — Travel / Stay / Food / Misc — shows both total and per-person budgets
- **Hotel recommendations**: Budget / Mid-range / Luxury tiers with price per night
- **Food recommendations**: Local cuisine with must-try dishes and price per person
- **Day-wise itinerary**: Complete schedule for each day with morning/afternoon/evening activities
- **Google Maps**: Embedded map for the destination
- **Images**: Unsplash dynamic images for all cards (never empty)

### Architecture
- **Frontend**: React + Vite (`artifacts/travel-planner/`, served at `/`)
- **Backend API**: Express 5 (`artifacts/api-server/`, served at `/api`)
- **External APIs used**: 
  - OpenStreetMap Nominatim (geocoding)
  - Overpass API (places of interest)
  - Unsplash (images via URL pattern)
  - Google Maps (embed iframe)

### API Endpoints
- `POST /api/travel/plan` — generate full travel plan
- `GET /api/travel/places?destination=X` — fetch places for a location
- `GET /api/healthz` — health check

### Key Files
- `artifacts/api-server/src/routes/travel/index.ts` — main travel plan route
- `artifacts/api-server/src/routes/travel/helpers.ts` — all helper functions (places, hotels, food, budget, itinerary)
- `artifacts/travel-planner/src/pages/Home.tsx` — planning form page
- `artifacts/travel-planner/src/pages/Plan.tsx` — results page
- `artifacts/travel-planner/src/context/TravelPlanContext.tsx` — shared state
- `lib/api-spec/openapi.yaml` — OpenAPI contract
