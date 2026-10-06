# Knowledge Atlas

A personal intellectual map for tracking *everything* you want to learn — philosophy, Hinduism, literary theory, piano, pop culture, history, science, business, languages, and whatever rabbit hole appears next.

## Architecture

- `index.html` — UI shell
- `app.js` — graph, search, suggestions, zoom, node editing
- `styles.css` — visual system
- `supabase.sql` — backend schema
- `supabase.js` — Supabase connection
- `config.example.js` — browser-safe configuration template

The app works in **local mode** immediately. If Supabase is configured, it syncs nodes, connections, notes, resources, questions and learning sessions to your database.

## 1. Create Supabase backend

Create a project at https://supabase.com/

Open SQL Editor and run `supabase.sql`.

Then copy `config.example.js` to `config.js` and add your Supabase project URL and anon/publishable key.

Do NOT put a Supabase service-role key in this repository.

## 2. Run locally

Because the app loads JavaScript modules, use a local server:

```bash
python3 -m http.server 8000
```

Then open:

http://localhost:8000

## 3. GitHub Pages

Push the files to GitHub. Enable:

Settings → Pages → Deploy from branch → main → root

For a static GitHub Pages deployment, `config.js` contains a public client key. That is okay for the Supabase anon/publishable key when Row Level Security is correctly configured. Never expose a service-role key.

## What makes this different

The map is not a hierarchy of "subjects". It is a **knowledge graph**.

A node can connect to many other nodes:

Philosophy → Existentialism → Sartre → Bad Faith

and also:

Bad Faith → Psychology → Self-deception

and:

Sartre → Literature → Literary theory

The app therefore becomes a map of *relationships*, not a folder system.

## Future upgrades

The database is designed for:

- AI-generated pathways
- books/articles/videos/resources
- questions and unresolved ideas
- learning sessions
- confidence/depth tracking
- cross-disciplinary connections
- recommendation history
- spaced review
- semantic/vector search
- automatic "you may also want to explore..." pathways


## Build 1 — visual map refresh

This version replaces the original overlapping label layout with a territory-based interactive SVG map.
It supports real zoom/pan, cleaner hierarchy, territory filtering, search, selection, and local-first storage.

The AI and Supabase persistence layers are intentionally the next build rather than being faked in the front end.
