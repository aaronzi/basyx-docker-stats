# Eclipse BaSyx Docker Stats

Static JSON endpoints for Eclipse BaSyx Docker pull statistics, published via GitHub Pages and ready for Shields badges.

## Endpoints

Expected base URL:

- [https://docker-stats.basyx.org/all.json](https://docker-stats.basyx.org/all.json)
- [https://docker-stats.basyx.org/go.json](https://docker-stats.basyx.org/go.json)
- [https://docker-stats.basyx.org/all.stats.json](https://docker-stats.basyx.org/all.stats.json)
- [https://docker-stats.basyx.org/go.stats.json](https://docker-stats.basyx.org/go.stats.json)

Current groups:

- all: total pulls for all `eclipsebasyx` images
- go: total pulls for images with a strict `-go` suffix

Payload split:

- `all.json` and `go.json`: strict Shields-compatible schema only
- `all.stats.json` and `go.stats.json`: extended payload including `pull_count` and metadata

Stats endpoint (`*.stats.json`) contains:

- Shields endpoint fields: `schemaVersion`, `label`, `message`, `color`
- Raw numeric field: `pull_count`
- Metadata: `group`, image counters, `generated_at`, `source`

## Shields Usage

Use Shields endpoint mode directly:

- All images:
  - [https://img.shields.io/endpoint?url=https%3A%2F%2Fdocker-stats.basyx.org%2Fall.json](https://img.shields.io/endpoint?url=https%3A%2F%2Fdocker-stats.basyx.org%2Fall.json)
- Go images:
  - [https://img.shields.io/endpoint?url=https%3A%2F%2Fdocker-stats.basyx.org%2Fgo.json](https://img.shields.io/endpoint?url=https%3A%2F%2Fdocker-stats.basyx.org%2Fgo.json)

## Local Development

Requirements:

- Node.js 20+

Commands:

```bash
npm install
npm run generate
```

Generated files are written to `docs/`.

## Automation

Workflow: `.github/workflows/update-docker-stats.yml`

- Runs daily by default (`cron: "17 3 * * *"`)
- Can be started manually via `workflow_dispatch`
- Runs TypeScript generator
- Commits updates in `docs/` only when data changed

To change refresh cadence, edit the cron expression in the workflow.

## GitHub Pages Setup

1. In repository settings, configure Pages to deploy from the `master` branch, `/docs` folder.
2. Ensure DNS for `docker-stats.basyx.org` points to GitHub Pages.
3. `docs/CNAME` is included and set to `docker-stats.basyx.org`.

## Extend with New Endpoint Groups

Add a new entry in `groups` in `scripts/generate-stats.ts`:

- `key`: output file name (`<key>.json`)
- `label`: badge label
- `color`: badge color
- `matcher`: filter predicate by repository name

Then rerun:

```bash
npm run generate
```
