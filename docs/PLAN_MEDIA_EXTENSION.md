# PicFlow — Extension Média & Workflow Révision

## Résumé

Étendre PicFlow pour supporter les visuels (PNG, SVG, PDF), les vidéos (MP4, MOV jusqu'à 500 Mo) et un workflow de révision/commentaires, en plus du flux photo existant (swipe approve/reject) qui reste inchangé.

---

## 1. Nouveaux modèles Prisma

### Project
Conteneur thématique (alternative à Event pour les contenus non liés à un événement).
- `name`, `description`, `churchId`, `createdById`
- Relations : `Media[]`, `ShareToken[]`

### Media (remplace Photo)
- `type` : `PHOTO | VISUAL | VIDEO`
- `status` : `PENDING | APPROVED | REJECTED` (photos) + `DRAFT | IN_REVIEW | REVISION_REQUESTED | FINAL_APPROVED` (visuels/vidéos)
- `eventId` OU `projectId` (mutuellement exclusif, jamais les deux)
- `duration` (secondes, vidéos uniquement)
- `scheduledDeletionAt`, `deletedFromS3` (rétention vidéos)
- Relations : `MediaVersion[]`, `Comment[]`

### MediaVersion
- `versionNumber`, `originalKey`, `thumbnailKey`, `notes`
- Lié à `Media` et `User` (auteur)
- Contrainte unique `[mediaId, versionNumber]`

### Comment
- `type` : `GENERAL | TIMECODE`
- `content`, `timecode` (optionnel, en secondes)
- `parentId` pour les réponses en thread
- Lié à `Media` et `User` (auteur)

### Modifications existantes
- **AppSettings** : ajouter `retentionDays Int @default(30)`
- **Event** : renommer relation `photos` → `media`
- **ShareToken** : ajouter `projectId` optionnel (en plus de `eventId`)
- **User** : ajouter relations `projects`, `mediaVersions`, `comments`
- **Church** : ajouter relation `projects`

---

## 2. Structure S3

```
events/{eventId}/photos/originals/{mediaId}.{ext}
events/{eventId}/photos/thumbnails/{mediaId}.webp
projects/{projectId}/visuals/originals/{mediaId}.{ext}
projects/{projectId}/visuals/thumbnails/{mediaId}.webp
projects/{projectId}/videos/originals/{mediaId}.{ext}
projects/{projectId}/videos/thumbnails/{mediaId}.webp
quarantine/{uploadId}.{ext}
versions/{mediaId}/v{n}/{mediaId}.{ext}
versions/{mediaId}/v{n}/{mediaId}.webp
```

---

## 3. Upload sécurisé (presigned URL)

Flux pour fichiers > 50 Mo (obligatoire pour vidéos, optionnel pour le reste) :

1. **`POST /api/media/upload/sign`** — Auth, validation Zod (filename, contentType, size, type, eventId|projectId). Crée une session in-memory, génère une presigned PUT URL contrainte (Content-Type, 500 Mo max, 15 min expiry). Retourne `{ uploadId, url, expiresAt }`.

2. **Client uploade directement vers S3** (quarantine/) avec barre de progression (XMLHttpRequest). Pour les vidéos : extraction thumbnail côté client via `<video>` + `<canvas>`.

3. **`POST /api/media/upload/confirm`** — Vérifie que le fichier existe (HEAD), valide les magic bytes (premiers 512 octets), traite le thumbnail (Sharp pour images, dataUrl fourni par le client pour vidéos), déplace de `quarantine/` vers le chemin final, crée le record `Media` en BDD.

**Sécurité** :
- CORS restreint au domaine de production
- Rate limiting sur `/sign` (50 req/h/utilisateur)
- Validation magic bytes post-upload
- Presigned URL à usage unique, chemin spécifique avec UUID

L'upload direct existant (`POST /api/photos/upload` via FormData) reste pour les photos < 50 Mo.

---

## 4. Workflow révision/commentaires

**Machine à états** (visuels & vidéos) :
```
DRAFT → IN_REVIEW → REVISION_REQUESTED → IN_REVIEW → FINAL_APPROVED
```

- Soumettre pour review : `DRAFT → IN_REVIEW`
- Demander une révision : `IN_REVIEW → REVISION_REQUESTED` (accompagné d'un commentaire)
- Soumettre une nouvelle version : `REVISION_REQUESTED → IN_REVIEW` (crée un `MediaVersion`)
- Approuver : `IN_REVIEW → FINAL_APPROVED`

Le flux photo existant (swipe `PENDING → APPROVED/REJECTED`) reste inchangé.

---

## 5. Rétention vidéos

- À l'approbation finale d'une vidéo : `scheduledDeletionAt = now + retentionDays`
- **`POST /api/cron/cleanup`** (protégé par secret) : supprime les originaux S3 des vidéos expirées, conserve thumbnails + métadonnées, marque `deletedFromS3 = true`
- `retentionDays` configurable dans Settings (défaut : 30 jours)

---

## 6. Nouveaux schemas Zod

| Fichier | Contenu |
|---------|---------|
| `src/lib/schemas/media.ts` | `MediaTypeEnum`, `MediaStatusEnum`, `MediaSchema`, `CreateMediaSchema`, constantes MIME types |
| `src/lib/schemas/project.ts` | `CreateProjectSchema`, `UpdateProjectSchema`, `ProjectWithStatsSchema` |
| `src/lib/schemas/version.ts` | `MediaVersionSchema`, `CreateVersionSchema` |
| `src/lib/schemas/comment.ts` | `CommentTypeEnum`, `CreateCommentSchema`, `CommentSchema` |
| `src/lib/schemas/upload.ts` | `RequestPresignedUrlSchema`, `PresignedUrlResponseSchema`, `ConfirmUploadSchema` |

---

## 7. Nouvelles routes API

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/projects` | GET, POST | CRUD projets |
| `/api/projects/[id]` | GET, PATCH, DELETE | Détail/modification/suppression projet |
| `/api/media/upload/sign` | POST | Demande presigned URL |
| `/api/media/upload/confirm` | POST | Confirmation upload + validation |
| `/api/media/[id]` | GET, DELETE | Détail/suppression média |
| `/api/media/[id]/status` | PATCH | Transition de statut (machine à états) |
| `/api/media/[id]/versions` | GET, POST | Liste/création de versions |
| `/api/media/[id]/comments` | GET, POST | Liste/création de commentaires |
| `/api/media/[id]/comments/[commentId]` | DELETE | Suppression commentaire |
| `/api/cron/cleanup` | POST | Nettoyage vidéos expirées |

---

## 8. Nouvelles pages & composants

### Pages admin
- `/projects` — Liste des projets
- `/projects/[id]` — Détail projet (upload, grille médias)
- `/review` — File de révision (médias en attente)
- `/media/[id]` — Détail média (viewer, commentaires, versions)

### Composants
- `MediaUploader` — Upload avec presigned URL + progress bar + extraction thumbnail vidéo côté client
- `MediaGrid` — Grille avec badges type/statut
- `MediaViewer` — Affichage `<img>` ou `<video>` selon le type
- `VersionTimeline` — Timeline verticale des versions
- `CommentThread` — Fil de commentaires avec support timecode
- `ReviewModal` — Modal plein écran : viewer + commentaires + actions

### Modifications existantes
- Dashboard : ajouter onglet/section Projets
- Navigation : ajouter lien Projets
- Event detail : utiliser `Media` au lieu de `Photo`

---

## 9. Nouveaux fichiers utilitaires

| Fichier | Rôle |
|---------|------|
| `src/lib/video.ts` | Validation vidéo (types, taille) |
| `src/lib/visual.ts` | Validation + traitement visuels (PNG via Sharp, SVG/PDF placeholder pour MVP) |
| `src/lib/magic-bytes.ts` | Validation type fichier par magic bytes |
| `src/lib/upload-session.ts` | Gestion sessions d'upload presigned (in-memory) |
| `src/lib/retention.ts` | Logique de nettoyage vidéos expirées |

---

## 10. Migration Photo → Media

1. Migration Prisma additive (créer nouvelles tables sans toucher `Photo`)
2. Script `scripts/migrate-photos-to-media.ts` : copie chaque `Photo` vers `Media` avec `type=PHOTO`, préserve les IDs et S3 keys
3. Mise à jour du code pour lire depuis `Media`
4. Suppression de la table `Photo` après validation

---

## 11. Phases d'implémentation

| Phase | Contenu |
|-------|---------|
| **1. Fondation** | Schema Prisma, Zod schemas, helpers S3, migration Photo→Media |
| **2. Projets** | CRUD projets, pages admin, upload direct petits fichiers |
| **3. Upload presigned** | Sign/confirm routes, MediaUploader avec progress, thumbnail vidéo client |
| **4. Workflow révision** | Commentaires, transitions statut, ReviewModal, page review |
| **5. Versioning** | Upload nouvelles versions, VersionTimeline |
| **6. Rétention** | Calcul scheduledDeletionAt, cron cleanup, settings UI |
| **7. Visuels avancés** | Thumbnails PDF/SVG (Puppeteer ou lib dédiée) |
| **8. Polish** | Migration production, tests, responsive, edge cases |

---

## 12. Vérification

- Créer un projet, uploader un visuel PNG < 50 Mo → vérifié via upload direct
- Uploader une vidéo MP4 ~200 Mo → vérifié via presigned URL
- Soumettre pour review, ajouter un commentaire avec timecode, demander révision
- Uploader v2, approuver → `scheduledDeletionAt` calculé
- Exécuter le cron cleanup → original S3 supprimé, thumbnail conservé
- Valider des photos d'événement via swipe → flux inchangé
