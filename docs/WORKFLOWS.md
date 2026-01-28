# PicFlow — Workflows de validation

## 1. Workflow actuel : Photos

Flux simple de validation par swipe, sans versioning ni commentaires.

```
Équipe Photo                    Pasteur/Responsable              Équipe Média
    │                                  │                              │
    │  Upload photos (FormData)        │                              │
    │──────────► [PENDING] ───────────►│                              │
    │                                  │  Swipe (approve/reject)      │
    │                                  │──────► [APPROVED]  ─────────►│
    │                                  │──────► [REJECTED]            │  Télécharge ZIP
    │                                  │                              │◄──── /d/[token]
```

### Machine à états

```
PENDING ──► APPROVED
        └─► REJECTED
```

- Transition unique et irréversible via swipe mobile (`/v/[token]`)
- Conteneur : **Event** uniquement
- Upload : FormData (< 50 Mo)
- Pas de versioning, pas de commentaires

---

## 2. Workflow cible : Visuels & Vidéos

Flux de révision itératif avec commentaires, versioning et rétention configurable.

```
Créateur                          Reviewer (pasteur/responsable)
    │                                  │
    │  Upload visuel/vidéo             │
    │──────► [DRAFT]                   │
    │                                  │
    │  Soumettre pour review           │
    │──────► [IN_REVIEW] ────────────►│
    │                                  │
    │                          ┌───────┤
    │                          │       │  Approuver
    │                          │       │──────► [FINAL_APPROVED] ✓
    │                          │       │
    │                          │       │  Demander révision + commentaire
    │  ◄───── [REVISION_REQUESTED] ◄──┘
    │                                  │
    │  Upload nouvelle version (v2)    │
    │──────► [IN_REVIEW] ────────────►│
    │           ...boucle...           │
```

### Machine à états

```
DRAFT ──► IN_REVIEW ──► FINAL_APPROVED
                    └─► REVISION_REQUESTED ──► IN_REVIEW (boucle)
```

- Conteneur : **Event** ou **Project**
- Upload : Presigned URL (jusqu'à 500 Mo pour les vidéos)
- Versioning : chaque révision crée un `MediaVersion`
- Commentaires : généraux ou avec timecode (vidéos)
- Rétention : suppression automatique des originaux vidéo après N jours

---

## 3. Comparaison

| Aspect | Photos (actuel) | Visuels & Vidéos (cible) |
|--------|----------------|--------------------------|
| Conteneur | Event | Event ou Project |
| Upload | FormData < 50 Mo | Presigned URL (jusqu'à 500 Mo) |
| Statuts | PENDING → APPROVED / REJECTED | DRAFT → IN_REVIEW → FINAL_APPROVED (+ boucle révision) |
| Versioning | Non | Oui (MediaVersion) |
| Commentaires | Non | Oui (général + timecode vidéo) |
| Validation UX | Swipe mobile | ReviewModal (viewer + commentaires + actions) |
| Rétention | Illimitée | Configurable (défaut 30 jours pour vidéos) |

---

## 4. Coexistence des deux flux

Le workflow photo par swipe **reste inchangé**. Les deux flux coexistent via le champ `Media.type` :

- `PHOTO` → workflow swipe (PENDING / APPROVED / REJECTED)
- `VISUAL` / `VIDEO` → workflow révision (DRAFT / IN_REVIEW / REVISION_REQUESTED / FINAL_APPROVED)

La transition de statut est contrôlée par la route `PATCH /api/media/[id]/status` qui applique la machine à états correspondante selon le type de média.
