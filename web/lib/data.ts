// Build-time data access (Server Components only). The JSON files are the
// static data release in public/data, written by `civictrace export`.
import "server-only";

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import type { BuyerDoc, Meta, Overview } from "./types";

const DATA_DIR = path.join(process.cwd(), "public", "data");

function read<T>(rel: string): T {
  return JSON.parse(readFileSync(path.join(DATA_DIR, rel), "utf8")) as T;
}

export function hasData(): boolean {
  return existsSync(path.join(DATA_DIR, "meta.json"));
}

export function getMeta(): Meta {
  return read<Meta>("meta.json");
}

export function getOverview(): Overview {
  return read<Overview>("overview.json");
}

export function getBuyer(code: string): BuyerDoc {
  return read<BuyerDoc>(path.join("buyers", `${code}.json`));
}

export function relationshipsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_INCLUDE_RELATIONSHIPS === "1";
}
