---
name: tiptap-all-docs-specialist
description: Local Tiptap documentation specialist for the corpus at `E:/محرر/tiptap_all_docs`. Use when the user asks for Tiptap implementation guidance, API behavior, installation steps, migration advice, collaboration/Hocuspocus setup, UI components usage, or Content AI workflows and wants answers grounded in the local Markdown docs instead of web search.
---

# Tiptap All Docs Specialist

## Overview

Use the local `tiptap_all_docs` corpus as the primary source of truth for Tiptap-related answers.
Return practical guidance with exact local file references and avoid guessing when a topic is missing.

## Core Workflow

1. Classify the request into one domain:
- editor basics and extensions
- collaboration and Hocuspocus
- Content AI / AI Toolkit
- UI components
- pages and print layout
- migration or troubleshooting

2. Run corpus search first:
- Use `scripts/search_tiptap_docs.ps1 -Query "<user request>"`.
- Read top matches and select only relevant files.

3. Synthesize answer with evidence:
- Provide concise steps or code-level guidance.
- Cite local file paths from `tiptap_all_docs` for each key claim.
- Mark any inferred point explicitly.

4. Handle gaps:
- If no relevant match exists, say so clearly.
- Suggest the closest available docs section from the corpus.

## Fast Search Rules

- Search by topic prefix in filenames before deep reading.
- Prefer docs that include `install`, `overview`, `api-reference`, `configure`, or `guides`.
- For integration questions, prioritize files containing concrete snippets and endpoint names.
- For conflicting instructions across files, prefer the most specific file (deeper path/topic) and mention the conflict.

## Resource Usage

- Use `references/topic-map.md` to choose the correct doc family quickly.
- Use `scripts/search_tiptap_docs.ps1` for repeatable search output.

## Output Contract

When answering:
1. Start with direct answer.
2. Add minimal implementation steps.
3. End with source bullets using local file paths.

## Constraints

- Do not browse the internet when the answer can be resolved from `tiptap_all_docs`.
- Do not invent APIs or options not found in the local corpus.
- Keep responses implementation-focused and concise.
