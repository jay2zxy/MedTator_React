# MedGenie

A medical text annotation tool built with React.

## Features

- **Schema Editor** — Define entity/relation tag schemas (DTD/JSON/YAML)
- **Annotation Editor** — CodeMirror 6-based text editor with inline tag highlighting, right-click entity creation, and relation linking
- **LLM Auto-Annotation** — Ollama-powered automatic entity recognition with negation detection
- **Statistics** — Corpus-level tag statistics and visualizations
- **Export** — Multi-format export (XML/BioC/JSON/CSV + ZIP)
- **IAA / Adjudication** — Inter-annotator agreement (F1/Cohen's Kappa) with adjudication and Excel reports
- **Converter** — Format conversion (Raw Text/MedTagger to XML)
- **Toolkit** — MedTaggerVis visualization

## Tech Stack

- React 18 + TypeScript + Vite
- Ant Design (UI components)
- Zustand (state management)
- CodeMirror 6 (text editor)
- Ollama REST API (LLM auto-annotation)
- Vitest + jsdom (unit testing)

## Getting Started

```bash
cd MedGenie-React
npm install
npm run dev        # development server at localhost:5173
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | TypeScript compile + Vite build |
| `npm test` | Run all tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | ESLint check |

## Project Structure

```
MedGenie-React/src/
├── store.ts                # Global state (Zustand)
├── types.ts                # Shared types
├── components/
│   ├── Annotation.tsx      # Annotation tab (ribbon + file list + editor + tags)
│   ├── AnnotationEditor.tsx# CM6 editor with tag highlighting
│   ├── AnnotationTable.tsx # Tag table with inline attribute editing
│   ├── SchemaEditor.tsx    # Schema editor dialog
│   ├── Statistics.tsx      # Corpus statistics
│   ├── Export.tsx          # Multi-format export
│   ├── Adjudication.tsx    # IAA calculation + adjudication
│   ├── Converter.tsx       # Format converter
│   ├── Toolkit.tsx         # MedTaggerVis visualization
│   └── ...                 # ContextMenu, TagPopupMenu, LinkingBanner, RelationLines
├── editor/                 # CM6 decorations, theme, spans, setup
├── parsers/                # DTD, annotation XML, BRAT, BioC parsers
└── utils/                  # File helpers, NLP toolkit, IAA calculator, Ollama client
```

## License

MIT
