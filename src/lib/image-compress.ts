// Compression d'image CÔTÉ NAVIGATEUR (canvas → WebP), sans dépendance externe.
//
// Deux usages :
//  - compressImageFile : prend un File brut (galerie/appareil), applique le
//    plafond d'entrée, redimensionne et ré-encode en WebP. Utilisé tel quel le
//    jour où on ajoutera l'upload d'affiches (poster_url/preview_url).
//  - canvasToWebpBlob : ré-encode un <canvas> déjà préparé (ex. recadrage avatar)
//    en WebP. Utilisé par AvatarUpload, qui produit déjà un canvas carré.
//
// L'utilisateur ne voit rien : son image part déjà optimisée. Le plafond
// d'entrée bloque l'absurde AVANT tout traitement (évite de faire ramer le
// navigateur). Le vrai rempart anti-saturation reste le garde-fou serveur.

/** Plafond dur en ENTRÉE (avant compression) — bloque l'absurde. */
export const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 Mo

export class ImageTooLargeError extends Error {
  constructor() {
    super("Image trop lourde (10 Mo maximum).");
    this.name = "ImageTooLargeError";
  }
}

export interface CompressOptions {
  /** Côté max (largeur ou hauteur) en pixels. Ratio préservé, jamais agrandi. */
  maxSize: number;
  /** Qualité WebP 0–1 (défaut 0.8). */
  quality?: number;
}

/** Ré-encode un canvas en Blob WebP (qualité par défaut 0.8). */
export function canvasToWebpBlob(canvas: HTMLCanvasElement, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Échec de l'encodage WebP."))),
      "image/webp",
      quality
    );
  });
}

/**
 * Compresse un File image en WebP : rejette si > MAX_INPUT_BYTES, redimensionne
 * au côté max (sans agrandir), ré-encode en WebP. Renvoie un Blob prêt à uploader.
 */
export async function compressImageFile(file: File, opts: CompressOptions): Promise<Blob> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageTooLargeError();
  }

  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const { maxSize, quality = 0.8 } = opts;
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const targetW = Math.max(1, Math.round(img.width * scale));
  const targetH = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponible.");
  ctx.drawImage(img, 0, 0, targetW, targetH);

  return canvasToWebpBlob(canvas, quality);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image illisible."));
    img.src = src;
  });
}
