import { readdir } from "node:fs/promises";
import path from "node:path";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export async function listFilms(filmsDir: string): Promise<string[]> {
  const entries = await readdir(filmsDir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
}

export async function listShotImages(filmDir: string): Promise<string[]> {
  const entries = await readdir(filmDir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((e) => e.isFile() && !e.name.startsWith(".") && IMAGE_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort();
}
