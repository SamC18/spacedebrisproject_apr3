# Frontend

React 19 + Vite interface for the Satellite Debris Risk Analyzer. See the [main README](../README.md) for what the app does and how to run the backend.

```bash
npm install
echo "VITE_API_BASE=http://localhost:8000" > .env.local   # optional: point at a local backend
npm run dev      # development server
npm run build    # production build in dist/
npm run lint
```

If `VITE_API_BASE` is not set, the app uses the hosted API at `https://spacedebrisproject-apr3.onrender.com`.
