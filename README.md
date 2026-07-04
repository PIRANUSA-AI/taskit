<p align="center">
  <img src="media/banner.svg" width="100%" alt="TASKIT" />
</p>

<p align="center">
  <strong>Audio to Action Items</strong> |
  <strong>AI Transcript and Summary</strong> |
  <strong>Task Assignment</strong> |
  <strong>Team Collaboration</strong>
</p>

<p align="center">
  <a href="#features">Features</a> .
  <a href="#architecture">Architecture</a> .
  <a href="#getting-started">Getting Started</a> .
  <a href="#deploy">Deploy</a> .
  <a href="https://github.com/anomalyco/opencode/issues">Report Bug</a>
</p>

---

TASKIT is a meeting intelligence platform built for internal teams at Piranusa. Upload audio recordings and receive accurate transcripts, AI generated summaries, and structured action items assigned to the right people. Every meeting becomes a source of truth for the team.

---

## Features

- **AI Transcription** powered by Deepgram Nova 3 with speaker diarization
- **Smart Summaries** extracted by GLM (Zhipu AI) in Bahasa Indonesia
- **Action Item Extraction** automatic task detection with owner assignment and confidence scoring
- **Task Playground** admin interface to manually create and assign tasks
- **Audio Playback** real time waveform visualization with speed control and keyboard shortcuts
- **Full Text Search** search across all transcripts with inline snippet preview
- **Team Dashboard** usage analytics, user management, and credit tracking
- **Mobile First** responsive PWA with floating navigation

---

## Architecture

```mermaid
flowchart LR
    A([User Upload]) --> B[API Server]
    B --> C[(Supabase Postgres)]
    B --> D[(Supabase Storage)]
    D --> E[Worker]
    E --> F[Deepgram API]
    E --> G[GLM Zhipu]
    F --> H[Transcript]
    G --> I[Summary]
    G --> J[Action Items]
    H --> K[(Database)]
    I --> K
    J --> K
    K --> L[Frontend SPA]
    L --> M[Task View]
    L --> N[Transcript View]
    L --> O[Dashboard]
```

### Service Layout

```mermaid
flowchart TB
    subgraph Frontend
        V[Vite SPA React]
        P[PWA Shell]
    end
    subgraph Backend
        A[API Server Hono]
        W[Worker tsx]
    end
    subgraph Storage
        PG[(Postgres Drizzle)]
        S3[(Supabase Storage S3)]
    end
    subgraph AI
        D[Deepgram Nova 3]
        G[GLM 4.5 Flash]
    end
    V --> A
    P --> A
    A --> PG
    A --> S3
    W --> S3
    W --> D
    W --> G
    W --> PG
```

### Data Flow

```mermaid
sequenceDiagram
    actor User
    participant UI as Frontend
    participant API as API Server
    participant DB as Postgres
    participant Store as Supabase Storage
    participant Worker as Worker Process
    participant AI as Deepgram + GLM

    User->>UI: Upload Audio
    UI->>API: POST /jobs
    API->>DB: Create Job (queued)
    API->>Store: Upload File
    API->>UI: Job Created
    UI->>User: Upload Complete

    Worker->>DB: Poll for queued jobs
    DB->>Worker: Claim Job
    Worker->>Store: Download Audio
    Worker->>AI: Transcribe Audio
    AI->>Worker: Transcript + Speakers
    Worker->>AI: Generate Insights
    AI->>Worker: Summary + Action Items
    Worker->>DB: Save Results
    Worker->>DB: Update Status (completed)
    UI->>DB: Poll Job Status
    DB->>UI: Completed
    UI->>User: Show Transcript
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Supabase project (Postgres + Storage)
- Deepgram API key
- GLM API key (Zhipu AI)

### Installation

```bash
git clone <repo>
cd taskit

cp .env.example backend/.env
# edit backend/.env with your credentials

cp .env.example frontend/.env
# edit frontend/.env with your VITE_ prefix vars

npm --prefix backend install
npm --prefix frontend install

npm --prefix backend run db:migrate
npm --prefix backend run db:seed
```

### Development

```bash
# Terminal 1 - API Server
npm --prefix backend run dev

# Terminal 2 - Worker (requires STORAGE_PROVIDER=s3)
npm --prefix backend run dev:worker

# Terminal 3 - Frontend
npm --prefix frontend run dev
```

---

## Deploy

TASKIT deploys on Fly.io as two process groups:

```mermaid
flowchart LR
    subgraph Fly.io
        A[App Process] --> C[(Supabase)]
        B[Worker Process] --> C
        A --> D[Supabase Storage]
        B --> D
    end
    subgraph External
        E[Deepgram]
        F[GLM Zhipu]
    end
    B --> E
    B --> F
```

```bash
fly deploy --ha=false
```

The release command runs migrations and seed automatically:

```
release_command = "node dist/db/migrate.js && node dist/db/seed.js"
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Hono, TypeScript, Drizzle ORM |
| Frontend | React, Vite, Tailwind CSS, Framer Motion |
| Database | Supabase Postgres (transaction pooler) |
| Storage | Supabase Storage (S3 compatible) |
| Transcription | Deepgram Nova 3 |
| Summary | GLM 4.5 Flash (Zhipu AI) |
| Task Queue | DB polled (no message broker) |
| Auth | Session cookies |

---

## Environment Variables

Key variables documented in `.env.example`. Critical ones:

```
DEEPGRAM_API_KEY
GLM_API_KEY
GLM_BASE_URL
DATABASE_URL
S3_ENDPOINT
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
ALLOW_PUBLIC_SIGNUP
```

---

## License

Copyright 2026 Contrivention. All rights reserved.

Built with passion by the Piranusa team, Indonesia.
