# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — production build (outputs to `dist/`)
- `npm run preview` — serve the production build locally
- `npm run lint` — run Oxlint (config in `.oxlintrc.json`)

There is no test runner configured in this project.

Requires a `.env` file (see `.env.example`) with `VITE_GEMINI_API_KEY` set to a key from https://aistudio.google.com/apikey. Optional `VITE_GEMINI_MODEL` (defaults to `gemini-flash-latest`). The dev server must be restarted after changing `.env`.

## Architecture

This is a client-only React + Vite app (React 19, react-router-dom v7, Tailwind v4) that generates classroom teaching resources (worksheets, lesson plans, quizzes, activity ideas, exam papers) via the Gemini API. There is no backend — auth, history, and saved content all live in `localStorage`.

### Generation pipeline

Every generator page (`WorksheetGenerator`, `LessonGenerator`, `QuizGenerator`, `ActivityIdeas`, `ExamPaper`) follows the same flow:

1. Page collects form data and calls `generateResource({ type, formData })` from `src/Services/aiService.js`.
2. `aiService.js` looks up a prompt builder from `src/Services/promptBuilder.js` (one per resource type: `buildWorksheetPrompt`, `buildLessonPrompt`, `buildQuizPrompt`, `buildActivityPrompt`, `buildExamPrompt`) and builds the prompt text from the form data.
3. The prompt is sent to `generateStructuredContent()` in `src/Services/geminiService.js`, which calls the Gemini `generateContent` REST endpoint directly (no SDK) with a fixed `responseSchema` forcing JSON output shaped as `{ title, summary, sections: [{ heading, items[] }] }`. Response shape is validated manually (`validateShape`) before use.
4. `aiService.js` attaches a type-specific note (estimated time/difficulty) and returns `{ title, summary, sections, note, prompt }` to the page.
5. The page renders the result and can call `recordHistory()` / `saveContent()` from `src/Services/contentStore.js` to persist it.

To add a new resource type: add a prompt builder in `promptBuilder.js`, register it in `PROMPT_BUILDERS` (and `NOTE_BUILDERS`) in `aiService.js`, add an entry to `RESOURCE_TYPES` in `contentStore.js`, and wire up a page + route.

Gemini error handling is centralized: `geminiService.js` throws typed errors (`GeminiConfigError`, `GeminiAuthError`, `GeminiRateLimitError`, `GeminiNetworkError`, `GeminiResponseError`), and `describeGeminiError()` converts them to a user-facing message. Generator pages catch errors from `generateResource` and render the result of `describeGeminiError(err)`.

### Auth and persistence

Auth is entirely client-side and not secure: `Login.jsx` checks credentials against a hardcoded email/password and sets `localStorage["aiClassroomAuth"] = "true"` on success. `ProtectedRoute.jsx` reads that same flag to gate routes. There is no real backend session — treat this as a prototype-level auth stub, not something to harden in place without discussing a real auth backend first.

`contentStore.js` persists generated resources to `localStorage` under `adiuvaret-history` (capped at 50 entries) and `adiuvaret-saved`, and defines the `RESOURCE_TYPES` map (label/path/icon per type) used across History/SavedContent/Dashboard pages.

Theme (`light`/`dark`) is stored in `localStorage["adiuvaret-theme"]` and applied via `data-theme` on `document.documentElement`; both `App.jsx` and `Login.jsx` independently read/write it on mount.

### Routing and layout

All routes are defined in `src/App.jsx`. Every authenticated page wraps its content in `<ProtectedRoute>` and renders the shared `Sidebar` + `Navbar` shell (see `WorksheetGenerator.jsx` for the canonical layout: `.app-shell` > `Sidebar` + `.main-panel` containing `Navbar` and a `.content-area`).

Note: `src/Pages/ExamPaperGenerator.jsx` exists but is not imported anywhere — `ExamPaper.jsx` is the page actually routed at `/exam`. Confirm which one is intended before editing exam-paper behavior.
