# État des lieux (code) & reste à faire

Date du constat : 22 janvier 2026

Ce document synthétise ce qui est **effectivement présent dans le code** et compare avec l’état des lieux partagé (Claude). Il sert de référence unique pour le backlog.

---

## 1) Comparatif “Claude” vs “code observé”

### Résumé rapide
- **MVP globalement fonctionnel** : auth, events, upload, partage, validation, download, API.
- **Écarts clés** : swipe tactile non implémenté, Swagger UI absente, nombre de routes API sous‑estimé.

### Tableau comparatif

| Module | Claude | Code observé | Écart / note |
|---|---|---|---|
| Auth | Login Google, routes protégées | ✅ OK (`src/lib/auth.ts`, `src/app/(auth)/*`) | — |
| Dashboard | Liste événements + stats | ✅ OK (`src/app/(auth)/dashboard/page.tsx`) | — |
| Événements | Création, détail, upload, suppression | ✅ OK (UI + API) | Édition d’événement dispo en API mais pas d’UI (`src/app/api/events/[id]/route.ts`) |
| Partage | Tokens validation/téléchargement | ✅ OK (UI + API) | — |
| Validation | “Swipe + grid récap” | ✅ Grid récap + boutons/clavier | ⚠️ **Pas de swipe tactile** (aucun handler touch/pointer) (`src/app/(public)/v/[token]/page.tsx`) |
| Téléchargement | Page média + ZIP | ✅ OK (page + ZIP) | ZIP sync côté API (peut être lourd) |
| API | 10 routes | ✅ 11 routes `route.ts` | Écart de comptage (inclut `validate/[token]/photo/[id]`) |

---

## 2) Ce qui est bien en place (MVP)

- **Flow complet** : upload → validation → téléchargement validé (ZIP).
- **Tokens de partage** : génération, listing, suppression.
- **Validation** : décisions + recap + soumission + statut event (passe à REVIEWED si plus de pending).
- **Stockage S3** : upload original + thumbnail, URLs signées.

---

## 3) Écarts / incohérences repérés

- **Swipe tactile absent** : pas de gestion touch/pointer pour valider/rejeter en glissant.
- **Swagger UI annoncée** : `/api/docs` expose l’OpenAPI, mais pas de page `/docs` dans l’app.
- **Upload formats** : backend accepte HEIC/HEIF, input UI limite à jpeg/png/webp.
- **Routes API** : 11 routes, pas 10 (voir `src/app/api/**/route.ts`).

---

## 4) Reste à faire (proposé)

### Priorité basse (améliorations)
- **Tests** : Vitest unitaires + Playwright e2e (aucun test actuellement).
- **PWA complète** : service worker + offline (manifest déjà présent dans `public/manifest.json`).
- **Emails** : notifications aux validateurs et à l’équipe média (pas d’intégration).
- **ZIP async** : job queue ou génération différée pour gros volumes.

### À considérer (qualité/UX)
- **Swipe mobile** : interaction tactile fluide (gestures).
- **Page `/docs`** : intégrer Swagger UI côté front ou page dédiée.
- **Édition d’événement** : UI pour update (l’API est prête).
- **Upload HEIC/HEIF** : aligner accept front/back (ou désactiver backend).

---

## 5) Références utiles

- Validation UI : `src/app/(public)/v/[token]/page.tsx`
- Téléchargement media : `src/app/(public)/d/[token]/page.tsx`
- Partage : `src/app/(auth)/events/[id]/share/page.tsx`
- API docs : `src/app/api/docs/route.ts`
- Routes API : `src/app/api/**/route.ts`

