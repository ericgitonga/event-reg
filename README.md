# event-reg

General-purpose multi-event registration platform (Next.js + Turso), generalized from
[busherian-hike](https://github.com/ericgitonga/busherian-hike).

## Local setup

```bash
npm install
npm run dev
```

Runs at http://localhost:3000.

## Testing

```bash
npm run test                        # Vitest unit suite
npm run build && npm start          # in one terminal
conda run -n ds python e2e/run.py   # in another; Playwright e2e smoke suite
```
