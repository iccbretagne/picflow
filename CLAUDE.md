# PicFlow - Contexte IA

Ce fichier fournit le contexte nécessaire pour qu'un agent IA puisse comprendre et contribuer au projet.

## Résumé du projet

**PicFlow** est une PWA de validation de photos pour les églises. Elle permet :
1. À l'équipe photo d'uploader des photos d'événements
2. Aux pasteurs/responsables de valider les photos via une interface mobile simple (swipe)
3. À l'équipe média de télécharger les photos validées

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Next.js    │────▶│   MySQL     │
│   (PWA)     │     │  (API)      │     │   (Prisma)  │
└─────────────┘     └──────┬──────┘     └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │ OVH Object  │
                   │ Storage (S3)│
                   └─────────────┘
```

## Stack technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Framework | Next.js (App Router) | 16.1.4 |
| Runtime | React | 19.2.3 |
| BDD | MySQL + Prisma ORM | Prisma 7.3.0 |
| Adapter BDD | @prisma/adapter-mariadb | 7.3.0 |
| Auth | NextAuth.js v5 beta | 5.0.0-beta.30 |
| Stockage | AWS SDK S3 (OVH compatible) | 3.972.0 |
| Validation | Zod + zod-to-openapi | Zod 4.3.5, openapi 8.4.0 |
| Styling | Tailwind CSS | 4.x |
| Images | Sharp | 0.34.5 |
| State | Zustand | 5.0.10 |

**Note importante :** Prisma 7+ utilise des adaptateurs de base de données (drivers adapters). Pour MySQL/MariaDB, utiliser `@prisma/adapter-mariadb` avec le package `mariadb`. Le `datasource` dans `schema.prisma` ne doit PAS contenir d'URL - la connexion est configurée dans `src/lib/prisma.ts`.

## Structure du projet

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # Routes API REST (18 endpoints)
│   ├── (auth)/            # Pages admin (authentifiées)
│   │   ├── dashboard/     # Liste événements + filtres
│   │   ├── events/        # Création + détail événement
│   │   ├── churches/      # CRUD églises
│   │   ├── users/         # Gestion utilisateurs
│   │   └── settings/      # Logo/favicon
│   ├── (public)/          # Pages publiques (token)
│   │   ├── v/[token]/     # Validation mobile (swipe)
│   │   └── d/[token]/     # Téléchargement média
│   └── favicon/           # Route dynamique favicon
├── components/            # Composants React
│   ├── ui/               # Button, Card, Badge, Input, etc.
│   ├── layout/           # AuthNav, HeaderLogo, LoginLogo
│   ├── photos/           # PhotoGrid, PhotoUploader
│   ├── events/           # EventActions
│   ├── dashboard/        # DashboardFilters
│   └── settings/         # LogoUploader, FaviconUploader
├── design/               # Design tokens ICC
└── lib/                   # Utilitaires
    ├── schemas/          # Schémas Zod (source de vérité)
    ├── auth.ts           # Config NextAuth
    ├── prisma.ts         # Client Prisma (mariadb adapter)
    ├── s3.ts             # Client S3/OVH
    ├── sharp.ts          # Traitement images
    ├── tokens.ts         # Gestion tokens partage
    ├── api-utils.ts      # Helpers API
    └── openapi.ts        # Génération spec OpenAPI
```

## Modèle de données

Voir `prisma/schema.prisma` pour le schéma complet.

**Entités principales :**
- `User` - Utilisateurs admin (Google OAuth)
- `Event` - Événements (culte, conférence, etc.)
- `Photo` - Photos avec status (PENDING/APPROVED/REJECTED)
- `ShareToken` - Liens de partage (VALIDATOR/MEDIA)

## API

Spec OpenAPI complète : `docs/openapi.yaml`

**Endpoints principaux :**
- `GET/POST /api/events` - CRUD événements
- `POST /api/photos/upload` - Upload multiple
- `GET/PATCH /api/validate/[token]` - Validation
- `GET /api/download/[token]` - Téléchargement

### Convention de réponse API

Toutes les réponses API suivent un format standardisé :

```typescript
// Succès (status 2xx)
{ data: T }

// Succès paginé
{ data: T[], pagination: { total, page, limit, pages } }

// Erreur (status 4xx/5xx)
{ error: { code: string, message: string, details?: unknown } }
```

**Helpers disponibles (`src/lib/api-utils.ts`) :**
- `successResponse(data, status?)` → `{ data: T }`
- `paginatedResponse(items, total, page, limit)` → `{ data: T[], pagination }`
- `errorResponse(error)` → `{ error: { code, message } }`

## Principes de développement

1. **IA-first** : Code clair, bien structuré, schémas Zod comme source de vérité
2. **Mobile-first** : L'interface de validation doit être ultra-simple sur mobile
3. **Sécurité** : Validation Zod sur toutes les entrées, tokens sécurisés
4. **Maintenabilité** : Architecture simple, peu de dépendances

## Règles pour les agents IA

### Lecture de documentation obligatoire

**AVANT toute implémentation utilisant une librairie externe :**

1. **Vérifier la version** utilisée dans `package.json`
2. **Lire la documentation officielle** pour cette version spécifique
3. **Attention aux breaking changes** entre versions majeures (ex: Prisma 6 → 7, Zod 3 → 4)

### Liens de documentation par version

| Librairie | Doc officielle |
|-----------|---------------|
| Prisma 7.x | https://www.prisma.io/docs |
| Next.js 16.x | https://nextjs.org/docs |
| NextAuth v5 | https://authjs.dev/getting-started |
| Zod 4.x | https://zod.dev |
| AWS SDK v3 | https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/ |

### Points d'attention spécifiques

- **Prisma 7** : Plus de `url` dans `datasource`, utiliser les driver adapters
- **NextAuth v5** : API différente de v4, utiliser `auth()` au lieu de `getServerSession()`
- **Zod 4** : Nouvelles méthodes, breaking changes depuis v3
- **Next.js 16** : App Router uniquement, nouvelles conventions

## Conventions de code

- TypeScript strict
- Schémas Zod dans `src/lib/schemas/`
- Types inférés depuis Zod (pas de types manuels)
- Composants UI réutilisables dans `src/components/ui/`
- Pas de console.log en production
- Gestion d'erreurs centralisée via `ApiError`

## État actuel

### Implémenté ✅

#### Core métier
- Schéma Prisma complet + 4 migrations appliquées
- 18 routes API (format standardisé `{ data }`)
- Auth Google (NextAuth v5)
- Page de login
- Page de validation mobile (swipe + grid + safe areas)
- Page de téléchargement pour l'équipe média (`/d/[token]`) + ZIP
- Utilitaires S3, Sharp, tokens

#### Interface admin
- Dashboard avec liste événements + filtres par statut
- Page création événement (avec sélection église)
- Page détail événement (upload + gestion + suppression)
- Page gestion des tokens de partage
- **Gestion des églises** : CRUD complet (`/churches`)
- **Gestion utilisateurs** : Approbation/rejet OAuth (`/users`)
- **Personnalisation** : Logo et favicon uploadables (`/settings`)

#### Composants
- UI: Button, Card, Badge, Input, Textarea, Select, ConfirmModal
- Photos: PhotoUploader, PhotoGrid
- Events: EventActions, DashboardFilters
- Layout: AuthNav, HeaderLogo, LoginLogo
- Settings: LogoUploader, FaviconUploader

#### Charte graphique ICC Rennes
- Palette couleurs appliquée (violet `#5E17EB`, jaune `#FFEB05`, rouge `#FF3131`, bleu `#38B6FF`)
- Typographie Montserrat intégrée
- Design tokens dans `src/design/tokens.ts`

#### Infrastructure
- Build automatique avec génération Prisma
- Vitest + Testing Library installés
- Spec OpenAPI disponible (`/api/docs`)

### À compléter 🚧

#### Qualité
- **Tests** : Infrastructure Vitest prête, aucun test écrit
- **Documentation OpenAPI** : Spec JSON dispo, pas d'interface Swagger UI

#### PWA
- **Service worker** : Pas de mode offline
- **Icônes PWA** : Référencées dans manifest.json mais fichiers absents dans `public/icons/`

#### Fonctionnalités avancées
- Notifications email

## Pour démarrer

```bash
# Installation
npm install
cp .env.example .env  # Configurer les variables

# Base de données
npx prisma generate
npx prisma migrate dev

# Développement
npm run dev
```

## Documentation

- [Expression de Besoin](./docs/EXPRESSION_BESOIN.md) - Contexte métier complet
- [Conception Technique](./docs/CONCEPTION_TECHNIQUE.md) - Architecture détaillée
- [RBAC](./docs/RBAC.md) - Rôles et contrôle d'accès
- [OpenAPI Spec](./docs/openapi.yaml) - Spec API complète
