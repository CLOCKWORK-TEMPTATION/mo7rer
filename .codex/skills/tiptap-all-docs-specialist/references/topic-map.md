# Tiptap Docs Topic Map

Use this map to route user questions to the right file family inside `E:/محرر/tiptap_all_docs`.

## File Naming Pattern

Most files follow:

`tiptap.dev_docs_<section>_<subsection>_<topic>.md`

## Main Families

1. `collaboration_*`

- Collaboration service setup, authentication, webhooks, REST API, snapshots.
- Use for multi-user editing and document sync.

2. `comments_*`

- Threaded comments, styling threads, integration commands, webhook, REST API.
- Use for annotation workflows.

3. `content-ai_*`

- Agent APIs, AI toolkit workflows, suggestions, reviews, provider integrations.
- Use for AI generation/review/tool streaming questions.

4. `ui-components_*`

- UI component installation, primitives, templates, node components.
- Use for editor UI integration and component behavior.

5. `pages_*`

- Print/page layout, page format, headers/footers, page breaks, utilities.
- Use for A4/pagination/print-ready flows.

6. `hocuspocus_*`

- Provider/server setup, hooks, scaling, persistence, custom extensions.
- Use for collaboration backend infrastructure.

7. `guides_*`

- Migration guides, performance, output formats, authentication, FAQ.
- Use for “how-to”, best practices, and troubleshooting.

8. `examples_*`

- Example implementations and experiments.
- Use for quick patterns and starter direction.

9. `resources_*`

- Changelog, incidents, trial notes, “what’s new”.
- Use for release notes and operational context.

## Query Shortcuts

- Installation: `install`, `getting-started`, `overview`
- API details: `api-reference`, `rest-api`, `hooks`, `configuration`
- AI workflow: `agent`, `ai-toolkit`, `review`, `suggestions`, `tools`
- Collaboration backend: `hocuspocus`, `provider`, `webhook`, `persistence`
- Print/pages: `pages`, `page-format`, `page-break`, `header-footer`

## Resolution Rule

When multiple matches conflict:

1. Prefer exact topic file (deepest filename match).
2. Prefer `api-reference` over generic `overview`.
3. Mention any conflict and show both source paths.
