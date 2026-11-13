# RaveOrb rules for Copilot
- Never open, read, print, or modify any .env file in backend/ or frontend/. Use .env.example to document variables.
- Backend: Express + TypeScript (ESM, use .js suffixes in imports). Tests: cd backend && npm test
- Frontend: Expo Router app in frontend/src. Follow frontend/AGENTS.md. Typecheck: cd frontend && npm run typecheck. Tests: node --test tests/*.test.cjs
- Keep backend/src/types/index.ts and frontend/src/types/event.ts in sync.
- Add or update tests for every behaviour change.
- Do not add dependencies without asking first.
- Before editing, explain your plan briefly. After editing, run the relevant checks and report the results.