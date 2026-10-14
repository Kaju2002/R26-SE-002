# R26-SE-002 — CareerNet / FraudAware

Monorepo: Node microservices, Python ML, Next.js dashboard, React Native app.

## Quick links

- **[Local development guide](./LOCAL_DEVELOPMENT.md)** — run services, Docker, tests
- **[Deployment](./DEPLOYMENT.md)** — production URLs
- **[ML tests](./tests/README.md)** — pytest structure

## Quick start

```powershell
docker compose up -d
cd services\user-management
npm install
npm run dev
```

Full port list and all commands → [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)

## Run all tests (repo root)

```powershell
npm test
```
