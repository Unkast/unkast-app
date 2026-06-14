// Optimisation des images de fond des cartes de catégories (page Recherche).
//
// Usage : npm run optimize:images
//
// Ce script NE touche QUE public/categories/. Il prend toutes les images quel
// que soit leur format (PNG, JPG, JPEG, WebP, TIFF, AVIF…), les convertit en
// WebP redimensionné (largeur max 1280px, qualité 80), et écrit <id>.webp pour
// chaque catégorie reconnue. Les sources non-WebP sont supprimées après
// conversion (un seul fichier final par catégorie). Les fichiers au nom non
// reconnu sont ignorés (jamais touchés).

import sharp from "sharp";
import { readdir, readFile, writeFile, unlink, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Les 8 identifiants techniques de project_category (= noms de fichiers attendus).
const CATEGORY_IDS = [
  "court-metrage",
  "moyen-metrage",
  "long-metrage",
  "documentaire",
  "clip",
  "publicite",
  "bande-demo",
  "scene-extrait",
];

const MAX_WIDTH = 1280;
const QUALITY = 80;
const INPUT_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".avif", ".gif"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATEGORIES_DIR = path.join(__dirname, "..", "public", "categories");

function fmtKo(bytes) {
  return `${(bytes / 1024).toFixed(0)} Ko`;
}

async function main() {
  let entries;
  try {
    entries = await readdir(CATEGORIES_DIR);
  } catch {
    console.error(`Dossier introuvable : ${CATEGORIES_DIR}`);
    process.exit(1);
  }

  // On ne garde que les fichiers image, regroupés par identifiant de base.
  const images = entries.filter((name) => INPUT_EXTS.has(path.extname(name).toLowerCase()));
  if (images.length === 0) {
    console.log("Aucune image à optimiser dans public/categories/.");
    return;
  }

  let done = 0;
  const unknown = [];

  for (const name of images) {
    const ext = path.extname(name).toLowerCase();
    const base = path.basename(name, path.extname(name));

    if (!CATEGORY_IDS.includes(base)) {
      unknown.push(name);
      continue;
    }

    const inputPath = path.join(CATEGORIES_DIR, name);
    const outputPath = path.join(CATEGORIES_DIR, `${base}.webp`);

    try {
      const sizeBefore = (await stat(inputPath)).size;

      // Lecture en buffer PUIS écriture : évite toute corruption si la source
      // est déjà <id>.webp (lecture/écriture sur le même fichier).
      const inputBuffer = await readFile(inputPath);
      const meta = await sharp(inputBuffer).metadata();

      const outputBuffer = await sharp(inputBuffer)
        .rotate() // respecte l'orientation EXIF
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer();

      await writeFile(outputPath, outputBuffer);

      // Supprime la source d'origine si ce n'était pas déjà le .webp final.
      if (ext !== ".webp") {
        await unlink(inputPath);
      }

      done++;
      console.log(
        `✓ ${base}.webp — ${meta.width ?? "?"}px → ${Math.min(meta.width ?? MAX_WIDTH, MAX_WIDTH)}px, ` +
          `${fmtKo(sizeBefore)} → ${fmtKo(outputBuffer.length)}` +
          (ext !== ".webp" ? ` (source ${ext} supprimée)` : "")
      );
    } catch (err) {
      console.error(`✗ Échec sur ${name} : ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n${done} image(s) optimisée(s).`);
  if (unknown.length > 0) {
    console.log(`\nIgnorées (nom non reconnu — renomme-les d'après un id de catégorie) :`);
    unknown.forEach((n) => console.log(`  · ${n}`));
    console.log(`\nIds attendus : ${CATEGORY_IDS.join(", ")}`);
  }
}

main();
