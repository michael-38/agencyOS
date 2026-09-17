# Evals

Hand-labeled expectations for real sites. `evals/cache/<name>/` (gitignored) holds each site's run so
re-running the eval spends no Firecrawl credits and only re-issues LLM calls whose inputs changed.

```bash
cd website-audit
npx tsx src/index.ts eval            # all sites → evals/results/<timestamp>.md
npx tsx src/index.ts eval --site treys-lawn
npx tsx src/index.ts eval --refresh  # drop the cache and re-fetch
```

Each `evals/sites/<name>.yaml` follows `_template.yaml`. Label verdicts after inspecting the run's
`report.json`, `raw/pages/*/mobile.fold.png`, and `judge.md`; the pipeline's first pass is a starting
point, not ground truth.

Metrics reported: verdict agreement, per-verdict confusion, industry accuracy, home-rule accuracy,
probe-fallback pages, and the candidate miss rate: a labeled `satisfied_at_url` outside the audit's scope,
i.e. not among the top-level pages linked from the home page (`candidates_selected[]`), separated from
candidates lost to `scrape-failed`. Pass `--judge-text full` to compare against untrimmed candidate text.
