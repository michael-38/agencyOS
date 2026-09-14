---
industry: _common
persona_name: Any visitor and any machine reader (search engine, AI assistant)
primary_goal: Understand what this page is about and find an answer without guessing
device_bias: mobile
---

## What this visitor is trying to do

This checklist applies to every audit regardless of industry. It covers machine readability and
answer-first structure: can a search engine, an AI assistant, or a hurried person tell what the
page is about, who it is for, and what to do next, without reading everything?

Judge these on structure and clarity, not on industry fit. The industry persona covers that.

## Checklist

| id | criterion | scope | check | weight |
|----|-----------|-------|-------|--------|
| structured-data | Valid JSON-LD structured data is present and parseable | home | deterministic | high |
| meta-title-description | The page has a descriptive title (10–70 chars) and meta description (50–170 chars) | home | deterministic | med |
| single-h1 | Exactly one H1 that states what the business does | home | deterministic | med |
| h2-structure | At least two non-empty, descriptive H2 section headings | home | deterministic | med |
| C-answer-first | The first sentence of each main section directly answers what the section is about (no throat-clearing) | home | judgment | med |
| faq-present | An FAQ section with question-form headings and short answers exists somewhere on the site | subpath | deterministic | med |
