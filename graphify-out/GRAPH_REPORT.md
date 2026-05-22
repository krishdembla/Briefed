# Graph Report - .  (2026-05-21)

## Corpus Check
- Corpus is ~7,368 words - fits in a single context window. You may not need a graph.

## Summary
- 195 nodes · 294 edges · 25 communities (16 shown, 9 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.87)
- Token cost: 15,000 input · 4,650 output

## Community Hubs (Navigation)
- [[_COMMUNITY_News Ingestion Pipeline|News Ingestion Pipeline]]
- [[_COMMUNITY_Map UI & Pin Display|Map UI & Pin Display]]
- [[_COMMUNITY_Runtime Dependencies|Runtime Dependencies]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_AI Summarization & GeoTagging|AI Summarization & GeoTagging]]
- [[_COMMUNITY_AI Design Principles|AI Design Principles]]
- [[_COMMUNITY_Retry & Source Filtering|Retry & Source Filtering]]
- [[_COMMUNITY_Dev Dependencies & Tooling|Dev Dependencies & Tooling]]
- [[_COMMUNITY_DB & Script Utilities|DB & Script Utilities]]
- [[_COMMUNITY_Mapbox Map Component|Mapbox Map Component]]
- [[_COMMUNITY_App Layout|App Layout]]
- [[_COMMUNITY_Check-in Streak Feature|Check-in Streak Feature]]
- [[_COMMUNITY_File Icon Assets|File Icon Assets]]
- [[_COMMUNITY_Globe Icon Assets|Globe Icon Assets]]
- [[_COMMUNITY_Window Icon Assets|Window Icon Assets]]
- [[_COMMUNITY_Next.js Logo Assets|Next.js Logo Assets]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Vercel Branding|Vercel Branding]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_Layered Architecture|Layered Architecture]]
- [[_COMMUNITY_Agent Rules Docs|Agent Rules Docs]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `runPipeline()` - 15 edges
3. `RawArticle` - 11 edges
4. `fetchFromNewsApi()` - 10 edges
5. `MapPin` - 9 edges
6. `MapContainer()` - 9 edges
7. `summarizeArticle` - 9 edges
8. `geoTagArticle` - 9 edges
9. `PinTopic` - 8 edges
10. `fetchWithRetry()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Retry + Timeout Principle (every external API call)` --rationale_for--> `fetchWithRetry()`  [INFERRED]
  CLAUDE.md → lib/fetchWithRetry.ts
- `summarizeArticle` --implements--> `Graceful Fallback Principle (fail gracefully on LLM failure)`  [INFERRED]
  lib/ai/summarize.ts → CLAUDE.md
- `LLM Wrapper Principle (never call API directly from business logic)` --rationale_for--> `summarizeArticle`  [INFERRED]
  CLAUDE.md → lib/ai/summarize.ts
- `LLM Wrapper Principle (never call API directly from business logic)` --rationale_for--> `geoTagArticle`  [INFERRED]
  CLAUDE.md → lib/ai/geoTag.ts
- `Two-Step GeoTag (Claude extracts location → Mapbox geocodes coordinates)` --semantically_similar_to--> `Topic-to-Color Mapping for Map Pins`  [INFERRED] [semantically similar]
  lib/ai/geoTag.ts → components/BriefedMap.tsx

## Hyperedges (group relationships)
- **News Ingestion Pipeline: Fetch → Deduplicate → Process → Store** — pipeline_run_runpipeline, sources_newsapi_fetchfromnewsapi, sources_finnhub_fetchfromfinnhub, sources_rss_fetchfromrss, pipeline_deduplicate_deduplicate, pipeline_run_processarticle, supabase_schema_pins [EXTRACTED 1.00]
- **Map UI Rendering: Pins API → MapContainer → BriefedMap + PinCard + TopicFilter** — api_pins_get, components_mapcontainer_mapcontainer, components_pincard_pincard, components_topicfilter_topicfilter, concept_geojson_pin_layer [EXTRACTED 1.00]
- **Shared PinTopic Taxonomy across types, components, and DB** — types_pipeline_pintopic, types_map_topic_colors, types_map_topic_labels, components_pincard_pincard, components_topicfilter_topicfilter, supabase_schema_pins [EXTRACTED 0.95]
- **AI Processing Layer: client + summarize + geoTag use shared anthropic client and Claude model to enrich pins** — lib_client_anthropic, lib_summarize_summarizearticle, lib_geotag_geotagarticle, lib_client_claude_model [EXTRACTED 1.00]
- **Prompt Template → LLM Call → Structured Output flow for both summarization and geo-tagging** — prompts_summarize, lib_summarize_summarizearticle, prompts_geo_tag, lib_geotag_geotagarticle [INFERRED 0.95]
- **Map UI Layer: BriefedMap renders geojson pins with topic colors and cluster interaction, CheckInStrip tracks read progress** — components_briefedmap_briefedmap, components_checkinstrip_checkinstrip, concept_cluster_zoom, concept_pin_topic_color [INFERRED 0.85]

## Communities (25 total, 9 thin omitted)

### Community 0 - "News Ingestion Pipeline"
Cohesion: 0.16
Nodes (20): geoTagArticle(), POST /api/pipeline/run, URL Normalization Deduplication Strategy, Batched Claude API Processing Pattern, deduplicate(), normalizeUrl(), finishRun(), PipelineResult (+12 more)

### Community 1 - "Map UI & Pin Display"
Cohesion: 0.17
Nodes (18): GET /api/pins, Home(), BriefedMap, MapContainer(), TODAY, PinCard(), PinCardProps, timeAgo() (+10 more)

### Community 2 - "Runtime Dependencies"
Cohesion: 0.09
Nodes (21): dependencies, @anthropic-ai/sdk, axios, dotenv, mapbox-gl, next, react, react-dom (+13 more)

### Community 3 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 4 - "AI Summarization & GeoTagging"
Cohesion: 0.21
Nodes (10): anthropic, GEO_TAG_PROMPT, MapboxFeature, MapboxGeocodingResponse, isValidTopic(), SUMMARIZE_PROMPT, summarizeArticle(), VALID_TOPICS (+2 more)

### Community 5 - "AI Design Principles"
Cohesion: 0.19
Nodes (14): Graceful Fallback Principle (fail gracefully on LLM failure), LLM Wrapper Principle (never call API directly from business logic), Prompts-as-Files Principle (all prompts in /prompts as separate files), Two-Step GeoTag (Claude extracts location → Mapbox geocodes coordinates), anthropic (Anthropic client instance), CLAUDE_MODEL constant, geoTagArticle, MapboxFeature Interface (+6 more)

### Community 6 - "Retry & Source Filtering"
Cohesion: 0.24
Nodes (10): Retry + Timeout Principle (every external API call), Exponential Backoff Retry Pattern, News Source Blocklist (entertainment/tabloid filter), fetchWithRetry(), BLOCKED_SOURCES, BLOCKED_SOURCES, fetchFromNewsApi(), isBlockedSource() (+2 more)

### Community 7 - "Dev Dependencies & Tooling"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/mapbox-gl, @types/node, @types/react (+2 more)

### Community 8 - "DB & Script Utilities"
Cohesion: 0.43
Nodes (3): supabase, main(), main()

### Community 9 - "Mapbox Map Component"
Cohesion: 0.47
Nodes (5): BriefedMap(), BriefedMapProps, topicColorExpression, Cluster Zoom-In Interaction Pattern, Topic-to-Color Mapping for Map Pins

### Community 10 - "App Layout"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 11 - "Check-in Streak Feature"
Cohesion: 0.50
Nodes (4): Briefed Project Vision, CheckInStrip(), CheckInStripProps, Daily Check-in Streak Mechanic

### Community 12 - "File Icon Assets"
Cohesion: 0.50
Nodes (5): Document Shape with Folded Corner, File Icon SVG, Next.js Default Public Asset, public/file.svg, Horizontal Text Lines Representation

### Community 13 - "Globe Icon Assets"
Cohesion: 0.50
Nodes (4): Briefed App, Next.js Default Public Asset, Globe Icon SVG, Globe SVG Icon

### Community 14 - "Window Icon Assets"
Cohesion: 1.33
Nodes (3): Next.js Application, Public Assets Directory, Window Icon SVG

### Community 15 - "Next.js Logo Assets"
Cohesion: 0.67
Nodes (3): Next.js, public/ directory, Next.js Logo SVG

## Knowledge Gaps
- **79 isolated node(s):** `config`, `name`, `version`, `private`, `dev` (+74 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fetchWithRetry()` connect `Retry & Source Filtering` to `News Ingestion Pipeline`, `AI Summarization & GeoTagging`, `AI Design Principles`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `geoTagArticle` connect `AI Design Principles` to `Retry & Source Filtering`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `MapPin` connect `Map UI & Pin Display` to `News Ingestion Pipeline`, `Mapbox Map Component`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `config`, `name`, `version` to the rest of the system?**
  _85 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Runtime Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `TypeScript Config` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._