# PicFlow - Rôles et Contrôle d'Accès (RBAC)

Ce document décrit le système de gestion des rôles et permissions dans PicFlow.

## Vue d'ensemble

PicFlow utilise un système RBAC simplifié basé sur :
1. **Rôles utilisateurs** - Définissent les capacités fonctionnelles
2. **Statuts utilisateurs** - Contrôlent l'accès à l'application
3. **Tokens de partage** - Permettent l'accès externe sans authentification

```
┌─────────────────────────────────────────────────────────────────┐
│                    ACCÈS AUTHENTIFIÉ                            │
├─────────────────────────────────────────────────────────────────┤
│  Super Admin (env)  →  Auto-activation + ADMIN                  │
│  ADMIN + ACTIVE     →  Accès complet interface admin            │
│  MEDIA + ACTIVE     →  Accès limité (prévu, non implémenté)     │
│  * + PENDING        →  Page d'attente                           │
│  * + REJECTED       →  Accès refusé                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    ACCÈS PAR TOKEN                              │
├─────────────────────────────────────────────────────────────────┤
│  VALIDATOR token    →  /v/[token] - Validation photos (swipe)   │
│  MEDIA token        →  /d/[token] - Téléchargement photos       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Rôles utilisateurs (`UserRole`)

Définis dans `prisma/schema.prisma` :

| Rôle | Description | Permissions |
|------|-------------|-------------|
| `ADMIN` | Équipe photo / Administrateur | Accès complet à l'interface admin |
| `MEDIA` | Équipe média | Prévu pour un accès restreint (non différencié actuellement) |

### Valeur par défaut
Tout nouvel utilisateur est créé avec le rôle `ADMIN`.

### Note importante
Actuellement, le rôle `MEDIA` n'est **pas différencié** de `ADMIN` dans l'interface. Les deux rôles ont accès aux mêmes fonctionnalités une fois le statut `ACTIVE`.

---

## Statuts utilisateurs (`UserStatus`)

| Statut | Description | Accès |
|--------|-------------|-------|
| `PENDING` | En attente d'approbation | ❌ Aucun accès - Page d'attente |
| `ACTIVE` | Approuvé | ✅ Accès selon le rôle |
| `REJECTED` | Rejeté | ❌ Aucun accès - Message de rejet |

### Workflow d'approbation

```
Connexion Google OAuth
        │
        ▼
┌───────────────┐
│ User créé     │
│ status=PENDING│
└───────┬───────┘
        │
        ▼
   Est super-admin ?
   (SUPER_ADMIN_EMAILS)
        │
   ┌────┴────┐
   │         │
  Oui       Non
   │         │
   ▼         ▼
ACTIVE    Attente approbation
(auto)    par un ADMIN
           │
     ┌─────┴─────┐
     │           │
  Approuvé    Rejeté
     │           │
     ▼           ▼
  ACTIVE     REJECTED
```

---

## Super Administrateurs

### Configuration

Variable d'environnement `SUPER_ADMIN_EMAILS` dans `.env` :

```env
SUPER_ADMIN_EMAILS=admin@example.com,autre.admin@example.com
```

### Comportement
- Liste d'emails séparés par des virgules
- Comparaison insensible à la casse
- **Auto-activation** : Ces utilisateurs sont automatiquement passés en `ACTIVE` + `ADMIN` à la connexion
- Ne peuvent pas être rétrogradés manuellement (réactivation automatique à chaque session)

### Implémentation (`src/lib/auth.ts`)

```typescript
const SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS?.split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean) || []
```

Vérification dans les callbacks `signIn` et `session` de NextAuth.

---

## Protection des routes API

### Helpers disponibles (`src/lib/auth.ts`)

| Helper | Vérifie | Utilisé pour |
|--------|---------|--------------|
| `requireAuth()` | Authentifié + status `ACTIVE` | Routes utilisateur standard |
| `requireAdmin()` | `requireAuth()` + role `ADMIN` | Routes administration |

### Codes d'erreur

| Code | Status HTTP | Signification |
|------|-------------|---------------|
| `UNAUTHORIZED` | 401 | Non authentifié |
| `PENDING_APPROVAL` | 403 | Compte en attente |
| `ACCESS_DENIED` | 403 | Compte rejeté |
| `FORBIDDEN` | 403 | Rôle insuffisant |

### Matrice des routes API

| Route | Protection | Description |
|-------|------------|-------------|
| `GET/POST /api/events` | `requireAuth` | CRUD événements |
| `GET/PATCH/DELETE /api/events/[id]` | `requireAuth` | Détail événement |
| `GET/POST/DELETE /api/events/[id]/share` | `requireAuth` | Tokens de partage |
| `POST /api/photos/upload` | `requireAuth` | Upload photos |
| `GET/POST /api/churches` | `requireAdmin` | CRUD églises |
| `GET/PATCH/DELETE /api/churches/[id]` | `requireAdmin` | Détail église |
| `GET /api/users` | `requireAdmin` | Liste utilisateurs |
| `PATCH /api/users/[id]` | `requireAdmin` | Modifier utilisateur |
| `GET/POST/DELETE /api/settings/logo` | `requireAdmin` | Logo app |
| `GET/POST/DELETE /api/settings/favicon` | `requireAdmin` | Favicon app |
| `GET/PATCH /api/validate/[token]` | Token | Validation (public) |
| `GET /api/download/[token]` | Token | Téléchargement (public) |

---

## Tokens de partage (`TokenType`)

Permettent l'accès externe sans authentification Google.

| Type | Accès | URL |
|------|-------|-----|
| `VALIDATOR` | Lecture photos + modification status | `/v/[token]` |
| `MEDIA` | Téléchargement photos validées uniquement | `/d/[token]` |

### Caractéristiques
- Token de 64 caractères généré aléatoirement
- Expiration optionnelle (`expiresAt`)
- Compteur d'utilisation (`usageCount`)
- Label personnalisable (ex: "Pasteur Martin")
- Lié à un événement spécifique

### Validation du token (`src/lib/tokens.ts`)

```typescript
// Vérifie : existence, type attendu, non expiré
const shareToken = await validateShareToken(token, "VALIDATOR")
```

---

## Interface de gestion des utilisateurs

Accessible via `/users` (ADMIN requis).

### Fonctionnalités
- Liste des utilisateurs avec filtres (status, rôle)
- Approbation des comptes en attente
- Rejet des comptes
- Modification du rôle

### Actions possibles

| Action | De | Vers | Disponible si |
|--------|-----|------|---------------|
| Approuver | `PENDING` | `ACTIVE` | Admin |
| Rejeter | `PENDING` | `REJECTED` | Admin |
| Réactiver | `REJECTED` | `ACTIVE` | Admin |
| Changer rôle | `ADMIN` ↔ `MEDIA` | - | Admin |

---

## Bonnes pratiques

### Configuration production

1. **Définir au moins un super-admin** dans `SUPER_ADMIN_EMAILS`
2. **Première connexion** : Le super-admin est auto-activé et peut approuver les autres
3. **Sauvegarder les emails super-admin** : Perte = nécessité intervention BDD

### Sécurité

- Les tokens de partage sont à usage limité dans le temps
- Les comptes rejetés ne peuvent pas se reconnecter (message explicite)
- Toute modification de status/rôle est tracée via `updatedAt`

---

## Évolutions futures possibles

1. **Différenciation ADMIN/MEDIA** : Interface spécifique pour le rôle MEDIA
2. **Permissions granulaires** : Par événement ou par église
3. **Audit log** : Historique des actions administratives
4. **Multi-tenant** : Isolation par église avec admins locaux
