# PicFlow

Photo validation workflow PWA for church media teams.

## Features

- **Mobile-first validation** - Swipe or tap to approve/reject photos
- **Share links** - Generate unique URLs for validators (no account needed)
- **HD photo preservation** - Full quality photos stored on S3
- **Multi-church support** - Organize events by church
- **Download center** - Approved photos available for media team

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Database**: MySQL (Prisma ORM)
- **Auth**: NextAuth.js (Google OAuth)
- **Storage**: OVH Object Storage (S3-compatible)
- **Styling**: Tailwind CSS
- **Validation**: Zod + OpenAPI (spec générée depuis Zod côté Next.js)

## Getting Started

### Prerequisites

- Node.js 20+
- MySQL 8+
- OVH Object Storage bucket
- Google OAuth credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/iccbretagne/picflow.git
cd picflow

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your values

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### Environment Variables

See `.env.example` for all required variables:

- `DATABASE_URL` - MySQL connection string
- `NEXTAUTH_SECRET` - Random secret for sessions
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - OAuth credentials
- `S3_*` - OVH Object Storage credentials
- `APP_URL` - Public URL of the application

## Documentation

- [Expression de Besoin](./docs/EXPRESSION_BESOIN.md)
- [Conception Technique](./docs/CONCEPTION_TECHNIQUE.md)
- [OpenAPI Spec](./docs/openapi.yaml) (snapshot, générée depuis Zod)
- [Mise en production](./docs/PRODUCTION.md)
- [Etat des lieux](./docs/STATUS.md)
- [Release process](./docs/RELEASE.md)
- [Changelog](./CHANGELOG.md)
- API Documentation: `/docs` (Swagger UI)

## Workflow

1. **Admin** creates an event and uploads photos
2. **Admin** generates a validation link
3. **Validator** receives the link and reviews photos (swipe UI)
4. **Media team** downloads approved photos

## Release

Tag releases with the script and record changes in `CHANGELOG.md`.

Example:

  ./scripts/release.sh v0.1.0-beta.3 "Beta iteration"

## License

MIT - See [LICENSE](./LICENSE)

## Credits

Built with Claude Code by ICC Bretagne.
