# Conception Technique - PicFlow

> Dépôt : github.com/iccbretagne/picflow
> Licence : MIT
> Document lié : [EXPRESSION_BESOIN.md](./EXPRESSION_BESOIN.md)

---

## 1. Modèle de Données

### 1.1 Schéma Entité-Relation

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    User     │       │    Event    │       │    Photo    │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id visages      │       │ id          │       │ id          │
│ email       │◄──────│ createdById │       │ eventId     │──────►│
│ name        │  1:N  │ name        │◄──────│ filename    │  N:1  │
│ image       │       │ date        │  1:N  │ originalKey │       │
│ role        │       │ church      │       │ thumbnailKey│       │
│ createdAt   │       │ description │       │ status      │       │
│ updatedAt   │       │ status      │       │ uploadedAt  │       │
└─────────────┘       │ createdAt   │       │ validatedAt │       │
                      │ updatedAt   │       │ validatedBy │       │
                      └─────────────┘       └─────────────┘
                             │
                             │ 1:N
                             ▼
                      ┌─────────────┐
                      │ ShareToken  │
                      ├─────────────┤
                      │ id          │
                      │ eventId     │
                      │ token       │
                      │ type        │  (validator | media)
                      │ expiresAt   │
                      │ createdAt   │
                      └─────────────┘
```

### 1.2 Schéma Prisma (MySQL)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ============================================
// UTILISATEURS
// ============================================

enum UserRole {
  ADMIN        // Équipe photo - peut tout faire
  MEDIA        // Équipe média - téléchargement uniquement
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?   @db.Text
  role          UserRole  @default(ADMIN)

  // Relations
  events        Event[]   @relation("EventCreator")

  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // NextAuth
  accounts      Account[]
  sessions      Session[]

  @@index([email])
}

// ============================================
// ÉVÉNEMENTS
// ============================================

enum EventStatus {
  DRAFT           // En cours d'upload
  PENDING_REVIEW  // En attente de validation
  REVIEWED        // Validation terminée
  ARCHIVED        // Archivé
}

model Event {
  id            String       @id @default(cuid())
  name          String       @db.VarChar(255)
  date          DateTime
  church        String       @db.VarChar(255)
  description   String?      @db.Text
  status        EventStatus  @default(DRAFT)

  // Relations
  createdById   String
  createdBy     User         @relation("EventCreator", fields: [createdById], references: [id])
  photos        Photo[]
  shareTokens   ShareToken[]

  // Timestamps
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@index([createdById])
  @@index([status])
  @@index([date])
}

// ============================================
// PHOTOS
// ============================================

enum PhotoStatus {
  PENDING   // En attente de validation
  APPROVED  // Validée
  REJECTED  // Rejetée
}

model Photo {
  id            String       @id @default(cuid())
  filename      String       @db.VarChar(255)
  originalKey   String       @db.VarChar(512)   // Clé S3 photo originale
  thumbnailKey  String       @db.VarChar(512)   // Clé S3 miniature
  mimeType      String       @db.VarChar(100)
  size          Int                              // Taille en bytes
  width         Int?                             // Dimensions originales
  height        Int?

  // Validation
  status        PhotoStatus  @default(PENDING)
  validatedAt   DateTime?
  validatedBy   String?      @db.VarChar(255)   // Nom ou token du validateur

  // Relations
  eventId       String
  event         Event        @relation(fields: [eventId], references: [id], onDelete: Cascade)

  // Timestamps
  uploadedAt    DateTime     @default(now())

  @@index([eventId])
  @@index([status])
  @@index([eventId, status])
}

// ============================================
// TOKENS DE PARTAGE
// ============================================

enum TokenType {
  VALIDATOR  // Accès validation (lecture + modification status)
  MEDIA      // Accès téléchargement (lecture photos validées uniquement)
}

model ShareToken {
  id            String     @id @default(cuid())
  token         String     @unique @db.VarChar(64)
  type          TokenType
  label         String?    @db.VarChar(255)    // Ex: "Pasteur Martin"

  // Expiration
  expiresAt     DateTime?

  // Utilisation
  lastUsedAt    DateTime?
  usageCount    Int        @default(0)

  // Relations
  eventId       String
  event         Event      @relation(fields: [eventId], references: [id], onDelete: Cascade)

  // Timestamps
  createdAt     DateTime   @default(now())

  @@index([token])
  @@index([eventId])
}

// ============================================
// NEXTAUTH (tables requises)
// ============================================

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

### 1.3 Index et Performance

| Table | Index | Justification |
|-------|-------|---------------|
| `User` | `email` | Recherche rapide à l'auth |
| `Event` | `createdById`, `status`, `date` | Filtres liste événements |
| `Photo` | `eventId`, `status`, `(eventId, status)` | Liste photos + filtres validation |
| `ShareToken` | `token`, `eventId` | Lookup rapide par token |

---

## 2. API - Architecture et Validation

### 2.1 Approche : Zod + OpenAPI

L'API suit une approche **schema-first** avec Zod comme source de vérité :

```
┌─────────────────┐
│  Schémas Zod    │  ← Source de vérité unique
└────────┬────────┘
         │
    ┌────┴────┬──────────────┬─────────────────┐
    ▼         ▼              ▼                 ▼
┌────────┐ ┌────────┐ ┌─────────────┐ ┌──────────────┐
│ Types  │ │ Valid. │ │ Spec OpenAPI│ │ Swagger UI   │
│ TS     │ │ Runtime│ │ auto-générée│ │ /api/docs    │
└────────┘ └────────┘ └─────────────┘ └──────────────┘
```

**Dépendances clés :**
```json
{
  "zod": "^4.3.5",
  "@asteasolutions/zod-to-openapi": "^8.4.0",
  "swagger-ui-react": "^5.x"
}
```

### 2.2 Structure des Schémas

```typescript
// src/lib/schemas/index.ts
// Point d'entrée - exporte tous les schémas

export * from "./event"
export * from "./photo"
export * from "./validation"
export * from "./common"
```

```typescript
// src/lib/schemas/common.ts
import { z } from "zod"
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi"

extendZodWithOpenApi(z)

// Schémas réutilisables
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
  limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
})

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      pages: z.number(),
    }),
  })

export const ErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional(),
  }),
}).openapi("Error")

export const IdParamSchema = z.object({
  id: z.string().cuid().openapi({ example: "clx1234567890abcdef" }),
})

export const TokenParamSchema = z.object({
  token: z.string().length(64).openapi({ example: "a1b2c3d4..." }),
})
```

```typescript
// src/lib/schemas/event.ts
import { z } from "zod"

// Enums
export const EventStatusEnum = z.enum([
  "DRAFT",
  "PENDING_REVIEW",
  "REVIEWED",
  "ARCHIVED",
]).openapi("EventStatus")

// Request schemas
export const CreateEventSchema = z.object({
  name: z.string().min(1).max(255).openapi({ example: "Culte du 19 janvier" }),
  date: z.string().datetime().openapi({ example: "2025-01-19T10:00:00Z" }),
  church: z.string().min(1).max(255).openapi({ example: "ICC Rennes" }),
  description: z.string().max(1000).optional().openapi({ example: "Culte dominical" }),
}).openapi("CreateEventRequest")

export const UpdateEventSchema = CreateEventSchema.partial().openapi("UpdateEventRequest")

export const ListEventsQuerySchema = z.object({
  status: EventStatusEnum.optional(),
  church: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).merge(PaginationSchema).openapi("ListEventsQuery")

// Response schemas
export const EventSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  date: z.string().datetime(),
  church: z.string(),
  description: z.string().nullable(),
  status: EventStatusEnum,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi("Event")

export const EventWithStatsSchema = EventSchema.extend({
  photoCount: z.number(),
  approvedCount: z.number(),
  rejectedCount: z.number(),
  pendingCount: z.number(),
}).openapi("EventWithStats")

// Share token
export const CreateShareTokenSchema = z.object({
  type: z.enum(["VALIDATOR", "MEDIA"]),
  label: z.string().max(255).optional().openapi({ example: "Pasteur Martin" }),
  expiresInDays: z.number().int().min(1).max(365).optional().openapi({ example: 7 }),
}).openapi("CreateShareTokenRequest")

export const ShareTokenResponseSchema = z.object({
  token: z.string(),
  url: z.string().url(),
  type: z.enum(["VALIDATOR", "MEDIA"]),
  expiresAt: z.string().datetime().nullable(),
}).openapi("ShareTokenResponse")
```

```typescript
// src/lib/schemas/photo.ts
import { z } from "zod"

export const PhotoStatusEnum = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
]).openapi("PhotoStatus")

export const PhotoSchema = z.object({
  id: z.string().cuid(),
  filename: z.string(),
  thumbnailUrl: z.string().url(),
  status: PhotoStatusEnum,
  width: z.number().nullable(),
  height: z.number().nullable(),
  uploadedAt: z.string().datetime(),
  validatedAt: z.string().datetime().nullable(),
}).openapi("Photo")

export const PhotoWithUrlSchema = PhotoSchema.extend({
  originalUrl: z.string().url(),
}).openapi("PhotoWithUrl")

export const UploadResponseSchema = z.object({
  uploaded: z.array(z.object({
    id: z.string().cuid(),
    filename: z.string(),
    thumbnailUrl: z.string().url(),
  })),
  errors: z.array(z.object({
    filename: z.string(),
    error: z.string(),
  })),
}).openapi("UploadResponse")
```

```typescript
// src/lib/schemas/validation.ts
import { z } from "zod"
import { PhotoSchema, PhotoStatusEnum } from "./photo"
import { EventSchema } from "./event"

export const ValidationEventResponseSchema = z.object({
  event: EventSchema.pick({ id: true, name: true, date: true, church: true }),
  photos: z.array(PhotoSchema),
  stats: z.object({
    total: z.number(),
    pending: z.number(),
    approved: z.number(),
    rejected: z.number(),
  }),
}).openapi("ValidationEventResponse")

export const SubmitValidationSchema = z.object({
  decisions: z.array(z.object({
    photoId: z.string().cuid(),
    status: z.enum(["APPROVED", "REJECTED"]),
  })).min(1),
}).openapi("SubmitValidationRequest")

export const ValidationResultSchema = z.object({
  updated: z.number(),
  stats: z.object({
    total: z.number(),
    approved: z.number(),
    rejected: z.number(),
  }),
}).openapi("ValidationResult")
```

### 2.3 Génération OpenAPI

La spec OpenAPI est **générée depuis les schémas Zod** (côté Next.js). Elle est exposée via `GET /api/docs` (JSON). Le fichier `docs/openapi.yaml` est un snapshot utile pour la lecture hors‑ligne.

```typescript
// src/lib/openapi.ts
import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi"
import * as schemas from "./schemas"

const registry = new OpenAPIRegistry()

// Enregistrer tous les schémas
registry.register("Event", schemas.EventSchema)
registry.register("Photo", schemas.PhotoSchema)
// ... etc

// Définir les endpoints
registry.registerPath({
  method: "get",
  path: "/api/events",
  tags: ["Events"],
  summary: "Lister les événements",
  security: [{ bearerAuth: [] }],
  request: { query: schemas.ListEventsQuerySchema },
  responses: {
    200: {
      description: "Liste des événements",
      content: { "application/json": { schema: schemas.PaginatedResponseSchema(schemas.EventWithStatsSchema) } },
    },
    401: { description: "Non authentifié", content: { "application/json": { schema: schemas.ErrorSchema } } },
  },
})

// ... autres endpoints

// Générer la spec
const generator = new OpenApiGeneratorV3(registry.definitions)

export const openApiDocument = generator.generateDocument({
  openapi: "3.0.3",
  info: {
    title: "PicFlow API",
    version: "1.0.0",
    description: "API de gestion de workflow de validation de photos",
    license: { name: "MIT", url: "https://opensource.org/licenses/MIT" },
  },
  servers: [
    { url: "https://picflow.example.com", description: "Production" },
    { url: "http://localhost:3000", description: "Développement" },
  ],
  tags: [
    { name: "Events", description: "Gestion des événements" },
    { name: "Photos", description: "Upload et gestion des photos" },
    { name: "Validation", description: "Interface de validation (token)" },
    { name: "Download", description: "Téléchargement des photos validées" },
  ],
})
```

### 2.4 Swagger UI Endpoint

```typescript
// src/app/api/docs/route.ts
import { openApiDocument } from "@/lib/openapi"

export async function GET() {
  return Response.json(openApiDocument)
}
```

```typescript
// src/app/docs/page.tsx
"use client"
import SwaggerUI from "swagger-ui-react"
import "swagger-ui-react/swagger-ui.css"

export default function DocsPage() {
  return <SwaggerUI url="/api/docs" />
}
```

### 2.5 Validation dans les Routes

```typescript
// src/lib/api-utils.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

export async function validateRequest<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T,
  source: "json" | "query" | "params" = "json"
): Promise<z.infer<T>> {
  let data: unknown

  if (source === "json") {
    data = await request.json()
  } else if (source === "query") {
    data = Object.fromEntries(new URL(request.url).searchParams)
  }

  const result = schema.safeParse(data)

  if (!result.success) {
    throw new ApiError(400, "Validation error", result.error.flatten())
  }

  return result.data
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message)
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: error.message, details: error.details } },
      { status: error.status }
    )
  }
  console.error(error)
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Une erreur est survenue" } },
    { status: 500 }
  )
}
```

```typescript
// Exemple d'utilisation dans une route
// src/app/api/events/route.ts
import { NextRequest, NextResponse } from "next/server"
import { validateRequest, errorResponse } from "@/lib/api-utils"
import { CreateEventSchema, ListEventsQuerySchema } from "@/lib/schemas"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    const query = await validateRequest(request, ListEventsQuerySchema, "query")

    const events = await prisma.event.findMany({
      where: {
        status: query.status,
        church: query.church,
        date: {
          gte: query.from ? new Date(query.from) : undefined,
          lte: query.to ? new Date(query.to) : undefined,
        },
      },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { date: "desc" },
    })

    return NextResponse.json({ data: events, pagination: { /* ... */ } })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await validateRequest(request, CreateEventSchema)

    const event = await prisma.event.create({
      data: { ...body, date: new Date(body.date), createdById: user.id },
    })

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
```

### 2.6 Vue d'ensemble des Endpoints

```
/api
├── /auth                    # NextAuth.js (automatique)
│   ├── GET  /[...nextauth]
│   └── POST /[...nextauth]
│
├── /events                  # Gestion événements (Admin)
│   ├── GET    /             # Liste événements
│   ├── POST   /             # Créer événement
│   ├── GET    /[id]         # Détail événement
│   ├── PATCH  /[id]         # Modifier événement
│   ├── DELETE /[id]         # Supprimer événement
│   └── POST   /[id]/share   # Générer token partage
│
├── /photos                  # Gestion photos (Admin)
│   ├── POST   /upload       # Upload photos (multipart)
│   ├── DELETE /[id]         # Supprimer photo
│   └── GET    /[id]/url     # URL signée téléchargement
│
├── /validate                # Interface validation (Token)
│   ├── GET    /[token]      # Récupérer événement + photos
│   ├── PATCH  /[token]      # Soumettre validations
│   └── GET    /[token]/photo/[id]  # URL signée photo HD
│
└── /download                # Interface téléchargement (Token/Auth)
    ├── GET    /[token]      # Liste photos validées
    ├── GET    /[token]/photo/[id]  # Télécharger une photo
    └── POST   /[token]/zip  # Générer ZIP (async)
```

> **Spec OpenAPI complète** : voir [`openapi.yaml`](./openapi.yaml)
>
> Documentation interactive disponible sur `/docs` (Swagger UI)

### 2.7 Résumé des Endpoints

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| **Events** ||||
| GET | `/api/events` | Session | Lister les événements |
| POST | `/api/events` | Session | Créer un événement |
| GET | `/api/events/{id}` | Session | Détail d'un événement |
| PATCH | `/api/events/{id}` | Session | Modifier un événement |
| DELETE | `/api/events/{id}` | Session | Supprimer un événement |
| POST | `/api/events/{id}/share` | Session | Générer un lien de partage |
| GET | `/api/events/{id}/share` | Session | Lister les tokens |
| **Photos** ||||
| POST | `/api/photos/upload` | Session | Upload multiple |
| DELETE | `/api/photos/{id}` | Session | Supprimer une photo |
| GET | `/api/photos/{id}/url` | Session | URL signée HD |
| **Validation** ||||
| GET | `/api/validate/{token}` | Token | Récupérer les photos à valider |
| PATCH | `/api/validate/{token}` | Token | Soumettre les décisions |
| GET | `/api/validate/{token}/photo/{id}` | Token | URL HD pour zoom |
| **Download** ||||
| GET | `/api/download/{token}` | Token | Lister les photos validées |
| GET | `/api/download/{token}/photo/{id}` | Token | Télécharger une photo |
| POST | `/api/download/{token}/zip` | Token | Générer un ZIP |
| GET | `/api/download/{token}/zip/{jobId}` | Token | Statut du ZIP |

---

## 3. Structure du Projet

```
picflow/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Tests + lint
│       └── deploy.yml          # Déploiement serveur
│
├── prisma/
│   ├── schema.prisma           # Schéma BDD
│   └── migrations/             # Migrations auto-générées
│
├── public/
│   ├── icons/                  # Icônes PWA
│   └── manifest.json           # Manifest PWA
│
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Routes authentifiées (Admin)
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx    # Liste événements
│   │   │   └── events/
│   │   │       ├── new/
│   │   │       │   └── page.tsx
│   │   │       └── [id]/
│   │   │           ├── page.tsx      # Détail + upload
│   │   │           └── share/
│   │   │               └── page.tsx  # Gestion partages
│   │   │
│   │   ├── (public)/           # Routes publiques
│   │   │   ├── layout.tsx
│   │   │   ├── v/              # Validation (validator)
│   │   │   │   └── [token]/
│   │   │   │       └── page.tsx
│   │   │   └── d/              # Download (media)
│   │   │       └── [token]/
│   │   │           └── page.tsx
│   │   │
│   │   ├── docs/               # Documentation API
│   │   │   └── page.tsx        # Swagger UI
│   │   │
│   │   ├── api/                # API Routes
│   │   │   ├── docs/
│   │   │   │   └── route.ts    # Spec OpenAPI JSON
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts
│   │   │   ├── events/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts
│   │   │   │       └── share/
│   │   │   │           └── route.ts
│   │   │   ├── photos/
│   │   │   │   ├── upload/
│   │   │   │   │   └── route.ts
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts
│   │   │   ├── validate/
│   │   │   │   └── [token]/
│   │   │   │       ├── route.ts
│   │   │   │       └── photo/
│   │   │   │           └── [id]/
│   │   │   │               └── route.ts
│   │   │   └── download/
│   │   │       └── [token]/
│   │   │           ├── route.ts
│   │   │           └── zip/
│   │   │               └── route.ts
│   │   │
│   │   ├── layout.tsx          # Layout racine
│   │   ├── page.tsx            # Page d'accueil / login
│   │   └── globals.css
│   │
│   ├── components/             # Composants React
│   │   ├── ui/                 # Composants génériques
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/             # Layout components
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── MobileNav.tsx
│   │   │
│   │   ├── events/             # Composants événements
│   │   │   ├── EventCard.tsx
│   │   │   ├── EventForm.tsx
│   │   │   └── EventList.tsx
│   │   │
│   │   ├── photos/             # Composants photos
│   │   │   ├── PhotoGrid.tsx
│   │   │   ├── PhotoUploader.tsx
│   │   │   └── PhotoViewer.tsx
│   │   │
│   │   └── validation/         # Composants validation
│   │       ├── SwipeValidator.tsx
│   │       ├── GridReview.tsx
│   │       ├── PhotoZoom.tsx
│   │       └── ValidationSummary.tsx
│   │
│   ├── lib/                    # Utilitaires et services
│   │   ├── prisma.ts           # Client Prisma singleton
│   │   ├── auth.ts             # Config NextAuth
│   │   ├── s3.ts               # Client S3 + helpers
│   │   ├── sharp.ts            # Traitement images
│   │   ├── tokens.ts           # Génération/validation tokens
│   │   ├── api-utils.ts        # Helpers API (validation, errors)
│   │   ├── openapi.ts          # Génération spec OpenAPI
│   │   └── schemas/            # Schémas Zod (source de vérité)
│   │       ├── index.ts        # Export centralisé
│   │       ├── common.ts       # Pagination, Error, etc.
│   │       ├── event.ts        # Event schemas
│   │       ├── photo.ts        # Photo schemas
│   │       └── validation.ts   # Validation schemas
│   │
│   ├── hooks/                  # React hooks custom
│   │   ├── useSwipe.ts         # Gestion gestes swipe
│   │   ├── usePhotos.ts        # État photos validation
│   │   └── useToast.ts         # Notifications toast
│   │
│   └── types/                  # Types TypeScript (inférés de Zod)
│       └── index.ts            # Re-export des types Zod
│
├── .env.example                # Variables d'environnement
├── .eslintrc.json
├── .gitignore
├── docker-compose.yml          # Dev local (MySQL)
├── Dockerfile                  # Build production
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

---

## 4. Flux S3 (OVH Object Storage)

### 4.1 Configuration

```typescript
// src/lib/s3.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const s3Client = new S3Client({
  region: "gra",  // Région OVH (Gravelines)
  endpoint: process.env.S3_ENDPOINT,  // https://s3.gra.io.cloud.ovh.net
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.S3_BUCKET!

// Structure des clés S3
// /events/{eventId}/originals/{photoId}.{ext}
// /events/{eventId}/thumbnails/{photoId}.webp
```

### 4.2 Flux Upload

```
┌─────────┐     ┌─────────────┐     ┌───────────┐     ┌─────────┐
│ Client  │────▶│ API Upload  │────▶│   Sharp   │────▶│ OVH S3  │
│ (Admin) │     │             │     │           │     │         │
└─────────┘     └─────────────┘     └───────────┘     └─────────┘
     │                                    │                │
     │  1. POST multipart                 │                │
     │     /api/photos/upload             │                │
     │                                    │                │
     │◀─────────────────────────────────────────────────────│
     │  4. Response avec thumbnailUrls    │                │
     │                                    │                │
                                          │                │
                              2. Resize   │   3. Upload    │
                                 WebP     │──────────────▶│
                                          │   - original   │
                                          │   - thumbnail  │
```

### 4.3 Traitement Image (Sharp)

```typescript
// src/lib/sharp.ts
import sharp from "sharp"

interface ProcessedImage {
  original: Buffer
  thumbnail: Buffer
  metadata: {
    width: number
    height: number
    format: string
  }
}

export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  const image = sharp(buffer)
  const metadata = await image.metadata()

  // Original : conserver tel quel (ou légère optimisation)
  const original = await image
    .rotate()  // Auto-rotation EXIF
    .toBuffer()

  // Thumbnail : 400px de large, WebP
  const thumbnail = await image
    .rotate()
    .resize(400, null, { withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()

  return {
    original,
    thumbnail,
    metadata: {
      width: metadata.width!,
      height: metadata.height!,
      format: metadata.format!,
    },
  }
}
```

### 4.4 URLs Signées

```typescript
// src/lib/s3.ts

// Durée de validité des URLs signées
const THUMBNAIL_URL_EXPIRY = 3600      // 1 heure (galerie)
const ORIGINAL_URL_EXPIRY = 300        // 5 minutes (téléchargement)

export async function getSignedThumbnailUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(s3Client, command, { expiresIn: THUMBNAIL_URL_EXPIRY })
}

export async function getSignedOriginalUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(s3Client, command, { expiresIn: ORIGINAL_URL_EXPIRY })
}
```

---

## 5. Sécurité

### 5.1 Authentification

| Route | Méthode | Authentification |
|-------|---------|------------------|
| `/api/events/*` | * | NextAuth (Google OAuth) - Admin |
| `/api/photos/*` | * | NextAuth (Google OAuth) - Admin |
| `/api/validate/[token]` | GET, PATCH | Token ShareToken valide |
| `/api/download/[token]` | * | Token ShareToken (MEDIA) ou Admin |

### 5.2 Génération de Tokens

```typescript
// src/lib/tokens.ts
import { randomBytes } from "crypto"

export function generateToken(): string {
  return randomBytes(32).toString("hex")  // 64 caractères hex
}

export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false
  return new Date() > expiresAt
}
```

### 5.3 Middleware de Validation

```typescript
// src/lib/auth.ts
import { prisma } from "./prisma"
import { isTokenExpired } from "./tokens"

export async function validateShareToken(token: string, requiredType?: TokenType) {
  const shareToken = await prisma.shareToken.findUnique({
    where: { token },
    include: { event: true },
  })

  if (!shareToken) {
    throw new ApiError(401, "Token invalide")
  }

  if (isTokenExpired(shareToken.expiresAt)) {
    throw new ApiError(401, "Token expiré")
  }

  if (requiredType && shareToken.type !== requiredType) {
    throw new ApiError(403, "Type de token incorrect")
  }

  // Mettre à jour les stats d'utilisation
  await prisma.shareToken.update({
    where: { id: shareToken.id },
    data: {
      lastUsedAt: new Date(),
      usageCount: { increment: 1 },
    },
  })

  return shareToken
}
```

### 5.4 Validation des Uploads

```typescript
// src/lib/upload.ts

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]

const MAX_FILE_SIZE = 50 * 1024 * 1024  // 50 Mo

export function validateFile(file: File): void {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new ApiError(400, `Type de fichier non supporté: ${file.type}`)
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new ApiError(400, `Fichier trop volumineux (max ${MAX_FILE_SIZE / 1024 / 1024} Mo)`)
  }
}
```

### 5.5 Rate Limiting

```typescript
// src/middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Rate limiting simple en mémoire (à remplacer par Redis en prod si besoin)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMIT = {
  "/api/validate": { max: 100, windowMs: 60000 },   // 100 req/min
  "/api/photos/upload": { max: 10, windowMs: 60000 }, // 10 uploads/min
}

export function middleware(request: NextRequest) {
  // Implémenter rate limiting basé sur IP ou token
}
```

### 5.6 Headers de Sécurité

```typescript
// next.config.js
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
]
```

---

## 6. Composants UI Clés

### 6.1 SwipeValidator (Mobile)

```typescript
// src/components/validation/SwipeValidator.tsx

interface SwipeValidatorProps {
  photos: Photo[]
  onDecision: (photoId: string, status: "APPROVED" | "REJECTED") => void
  onComplete: () => void
}

// États internes
// - currentIndex: photo affichée
// - decisions: Map<photoId, status>
// - showUndo: boolean (toast annulation)

// Gestes
// - Swipe gauche : rejeter
// - Swipe droite : valider
// - Tap bouton : valider/rejeter
// - Double tap : zoom
```

### 6.2 GridReview (Récapitulatif)

```typescript
// src/components/validation/GridReview.tsx

interface GridReviewProps {
  photos: PhotoWithDecision[]
  filter: "all" | "approved" | "rejected"
  onToggle: (photoId: string) => void
  onZoom: (photoId: string) => void
  onConfirm: () => void
}

// Affichage
// - Grille 3 colonnes (mobile) / 4-6 colonnes (desktop)
// - Badge ✓/✗ sur chaque miniature
// - Filtres en haut
// - Bouton confirmer sticky en bas
```

### 6.3 PhotoUploader (Admin)

```typescript
// src/components/photos/PhotoUploader.tsx

interface PhotoUploaderProps {
  eventId: string
  onUploadComplete: (photos: Photo[]) => void
}

// Fonctionnalités
// - Drag & drop zone
// - Sélection multiple
// - Preview avant upload
// - Barre de progression globale
// - Retry sur erreur individuelle
```

---

## 7. PWA Configuration

### 7.1 Manifest

```json
// public/manifest.json
{
  "name": "PicFlow",
  "short_name": "PicFlow",
  "description": "Photo validation workflow",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 7.2 Service Worker

```typescript
// Stratégies de cache
// - App shell : cache-first
// - Miniatures : cache-first avec revalidation
// - API : network-first
// - Originaux : network-only (trop volumineux)
```

---

## 8. Variables d'Environnement

```bash
# .env.example

# Base de données
DATABASE_URL="mysql://user:password@localhost:3306/picflow"

# NextAuth
NEXTAUTH_URL="https://picflow.example.com"
NEXTAUTH_SECRET="générer-avec-openssl-rand-base64-32"

# Google OAuth
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="xxx"

# OVH Object Storage (S3)
S3_ENDPOINT="https://s3.gra.io.cloud.ovh.net"
S3_REGION="gra"
S3_BUCKET="picflow"
S3_ACCESS_KEY_ID="xxx"
S3_SECRET_ACCESS_KEY="xxx"

# Application
APP_URL="https://picflow.example.com"
```

---

## 9. Déploiement

### 9.1 Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "server.js"]
```

### 9.2 Script de déploiement

```bash
#!/bin/bash
# deploy.sh

set -e

echo "Pulling latest changes..."
git pull origin main

echo "Building Docker image..."
docker build -t picflow:latest .

echo "Running migrations..."
docker run --rm --env-file .env picflow:latest npx prisma migrate deploy

echo "Restarting container..."
docker stop picflow || true
docker rm picflow || true
docker run -d \
  --name picflow \
  --env-file .env \
  --network web \
  -l "traefik.enable=true" \
  -l "traefik.http.routers.picflow.rule=Host(\`picflow.example.com\`)" \
  -l "traefik.http.routers.picflow.tls=true" \
  -l "traefik.http.routers.picflow.tls.certresolver=letsencrypt" \
  picflow:latest

echo "Done!"
```

---

## 10. Tests

### 10.1 Structure

```
tests/
├── unit/
│   ├── lib/
│   │   ├── tokens.test.ts
│   │   └── sharp.test.ts
│   └── components/
│       └── SwipeValidator.test.tsx
│
├── integration/
│   ├── api/
│   │   ├── events.test.ts
│   │   ├── photos.test.ts
│   │   └── validate.test.ts
│   └── auth.test.ts
│
└── e2e/
    ├── validation-flow.spec.ts
    └── upload-flow.spec.ts
```

### 10.2 Outils

| Type | Outil |
|------|-------|
| Unit/Integration | Vitest |
| Composants | React Testing Library |
| E2E | Playwright |

---

*Document généré le 21 janvier 2025*
*Version : 1.0 - Conception technique initiale*
