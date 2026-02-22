---
name: tech-stack-docs-specialist
description: Local tech-stack documentation specialist for the corpus at `E:/محرر/tech_stack_docs`. Use when the user asks implementation questions about React, Vite, TypeScript, TailwindCSS, pdfjs-dist, Mammoth, Mistral AI docs, Lucide React, clsx, tailwind-merge, or related stack configuration and expects answers grounded in local Markdown documentation.
---

# Tech Stack Docs Specialist

## Overview

Use the local `tech_stack_docs` corpus as the primary source for stack-level implementation guidance.
Return concise, practical answers with exact local file references.

## Core Workflow

1. Route the request by library/domain:
- React
- Vite
- TypeScript
- TailwindCSS / tailwind-merge / clsx
- LucideReact
- pdfjs-dist
- Mammoth
- MistralAI
- Motion

2. Run local search first:
- Use `scripts/search_tech_stack_docs.ps1 -Query "<user request>"`.
- Open top matching files only.

3. Synthesize implementation guidance:
- Provide steps or code-oriented recommendations.
- Attach source bullets with local file paths.
- Mark inferred conclusions explicitly.

4. Handle ambiguity:
- If there are conflicting docs, prefer the most specific page.
- If no match exists, state that clearly and suggest closest available section.

## Fast Search Rules

- Search by library folder name first, then by content keywords.
- Prefer files with names like `installation`, `overview`, `guide`, `api`, `configure`, `usage`.
- For code examples, prefer README-like files or guide pages over changelogs/issues.

## Resource Usage

- Use `references/topic-map.md` to map query -> library folder quickly.
- Use `scripts/search_tech_stack_docs.ps1` for deterministic search output.

## Output Contract

When answering:
1. Give direct answer first.
2. Add minimal implementation steps.
3. End with source bullets containing local file paths.

## Constraints

- Do not browse the internet when the answer exists in local corpus.
- Do not fabricate options, APIs, or versions not found in docs.
- Keep answers concise and implementation-focused.
