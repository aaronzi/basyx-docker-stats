import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_URL = "https://hub.docker.com/v2/repositories/eclipsebasyx?page_size=100";
const CACHE_SECONDS = 24 * 60 * 60;

interface DockerHubResponse {
  results?: DockerHubRepository[];
  next?: string | null;
}

interface DockerHubRepository {
  name?: unknown;
  pull_count?: unknown;
}

interface RepositoryStats {
  name: string;
  pullCount: number;
}

interface EndpointGroup {
  key: string;
  label: string;
  color: string;
  matcher: (name: string) => boolean;
}

interface GroupAggregate {
  total: number;
  selectedImageCount: number;
}

const groups: EndpointGroup[] = [
  {
    key: "all",
    label: "docker pulls",
    color: "blue",
    matcher: () => true,
  },
  {
    key: "go",
    label: "docker pulls",
    color: "teal",
    matcher: (name) => name.endsWith("-go"),
  },
];

function humanizeCount(value: number): string {
  if (value < 1_000) {
    return `${value}`;
  }

  const units = ["k", "M", "B", "T"];
  let number = value;

  for (const unit of units) {
    number /= 1_000;
    if (number < 1_000 || unit === units[units.length - 1]) {
      const roundedDown = Math.floor(number * 10) / 10;
      if (roundedDown >= 100) {
        return `${Math.round(roundedDown)}${unit}`;
      }
      return `${roundedDown.toFixed(1).replace(/\.0$/, "")}${unit}`;
    }
  }

  return `${value}`;
}

async function fetchAllRepositories(): Promise<DockerHubRepository[]> {
  const allEntries: DockerHubRepository[] = [];
  let nextUrl: string | null = SOURCE_URL;

  while (nextUrl) {
    const response = await fetch(nextUrl);
    if (!response.ok) {
      throw new Error(`Docker Hub request failed (${response.status} ${response.statusText})`);
    }

    const payload = (await response.json()) as DockerHubResponse;
    if (!Array.isArray(payload.results)) {
      throw new Error("Unexpected Docker Hub payload: results must be an array");
    }

    allEntries.push(...payload.results);
    nextUrl = typeof payload.next === "string" && payload.next.length > 0 ? payload.next : null;
  }

  return allEntries;
}

function normalizeRepositories(entries: DockerHubRepository[]): RepositoryStats[] {
  const normalized: RepositoryStats[] = [];

  for (const entry of entries) {
    if (typeof entry.name !== "string" || entry.name.length === 0) {
      continue;
    }
    if (typeof entry.pull_count !== "number" || !Number.isFinite(entry.pull_count)) {
      continue;
    }

    normalized.push({ name: entry.name, pullCount: entry.pull_count });
  }

  if (normalized.length === 0) {
    throw new Error("No valid repositories with pull_count were found");
  }

  return normalized;
}

function computeGroupAggregate(group: EndpointGroup, repositories: RepositoryStats[]): GroupAggregate {
  const selected = repositories.filter((repo) => group.matcher(repo.name));
  const total = selected.reduce((sum, repo) => sum + repo.pullCount, 0);

  return {
    total,
    selectedImageCount: selected.length,
  };
}

function buildShieldsPayload(group: EndpointGroup, aggregate: GroupAggregate) {
  return {
    schemaVersion: 1,
    label: group.label,
    message: humanizeCount(aggregate.total),
    color: group.color,
    cacheSeconds: CACHE_SECONDS,
  };
}

function buildStatsPayload(
  group: EndpointGroup,
  repositories: RepositoryStats[],
  aggregate: GroupAggregate,
  generatedAt: string,
) {

  return {
    schemaVersion: 1,
    label: group.label,
    message: humanizeCount(aggregate.total),
    color: group.color,
    cacheSeconds: CACHE_SECONDS,
    pull_count: aggregate.total,
    group: group.key,
    selected_image_count: aggregate.selectedImageCount,
    total_image_count: repositories.length,
    generated_at: generatedAt,
    source: SOURCE_URL,
  };
}

async function writeOutputs(repositories: RepositoryStats[]): Promise<void> {
  const outputDir = path.resolve(process.cwd(), "docs");

  await mkdir(outputDir, { recursive: true });
  const generatedAt = new Date().toISOString();

  for (const group of groups) {
    const aggregate = computeGroupAggregate(group, repositories);
    const shieldsPayload = buildShieldsPayload(group, aggregate);
    const statsPayload = buildStatsPayload(group, repositories, aggregate, generatedAt);

    const shieldsPath = path.join(outputDir, `${group.key}.json`);
    await writeFile(shieldsPath, `${JSON.stringify(shieldsPayload, null, 2)}\n`, "utf-8");

    const statsPath = path.join(outputDir, `${group.key}.stats.json`);
    await writeFile(statsPath, `${JSON.stringify(statsPayload, null, 2)}\n`, "utf-8");
  }
}

async function main(): Promise<void> {
  const repositories = normalizeRepositories(await fetchAllRepositories());
  await writeOutputs(repositories);
  console.log(`Generated ${groups.length} endpoint files in docs/`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to generate stats: ${message}`);
  process.exit(1);
});
