"use client";
// Image d'un film : apercu, envoi d'une image recadree en 16:9 (compressee dans
// le navigateur), retour a l'image de la video.
// POST / DELETE /api/projects/[id]/poster
import { useCallback, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { canvasToWebpBlob } from "@/lib/image-compress";
import Button from "@/components/ui/Button";
import { Note } from "./parts";
import { callApi, type ManagedProject, type ShowToast } from "./api";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
// Sortie : 1280 x 720 au plus, jamais agrandie.
const OUT_WIDTH = 1280;
const QUALITY = 0.82;
// Une image envoyee vit dans le bucket public « posters ».
const UPLOADED_MARK = "/storage/v1/object/public/posters/";

const helpCls = "text-xs leading-relaxed text-text-secondary";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image illisible."));
    img.src = src;
  });
}

export default function PosterUpload({
  project,
  reload,
  showToast,
}: {
  project: ManagedProject;
  reload: () => Promise<void>;
  showToast: ShowToast;
}) {
  // URL locale (blob:) de l'image en cours de recadrage.
  const [source, setSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zoomId = useId();

  const url = `/api/projects/${project.id}/poster`;
  const isUploaded = Boolean(project.poster_url?.includes(UPLOADED_MARK));

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  function closeCrop() {
    if (source) URL.revokeObjectURL(source);
    setSource(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError("Format non accepté. Choisis une image JPG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Image trop lourde : 5 Mo maximum.");
      return;
    }
    setError("");
    setSource(URL.createObjectURL(file));
  }

  async function apply() {
    if (!source || !area) return;
    setBusy(true);
    setError("");

    let blob: Blob;
    try {
      const image = await loadImage(source);
      const width = Math.max(1, Math.min(OUT_WIDTH, Math.round(area.width)));
      const height = Math.max(1, Math.round((width * 9) / 16));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas non disponible.");
      ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, width, height);
      blob = await canvasToWebpBlob(canvas, QUALITY);
    } catch {
      setBusy(false);
      setError("Image illisible. Essaie avec un autre fichier.");
      return;
    }

    const form = new FormData();
    form.append("file", blob, "poster.webp");
    const r = await callApi(url, "POST", form);
    if (!r.ok) {
      setBusy(false);
      setError(r.error);
      return;
    }
    showToast("Image mise à jour");
    await reload();
    setBusy(false);
    closeCrop();
  }

  async function restore() {
    setBusy(true);
    setError("");
    const r = await callApi<{ poster_url?: string | null }>(url, "DELETE");
    if (r.ok) {
      showToast(r.data.poster_url ? "Image de la vidéo rétablie" : "Image retirée : la vidéo n'a pas d'image");
      await reload();
    } else {
      setError(r.error);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex aspect-video w-full max-w-sm items-center justify-center overflow-hidden rounded-media border border-white/10 bg-white/5">
        {project.poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.poster_url} alt={`Image du film ${project.title}`} className="size-full object-cover" />
        ) : (
          <p className={helpCls}>Aucune image</p>
        )}
      </div>

      <p className={helpCls}>
        Format horizontal 16:9, en JPG, PNG ou WebP (5 Mo maximum). Par défaut, c&apos;est l&apos;image de la vidéo qui est utilisée.
      </p>

      {error && !source && <Note>{error}</Note>}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          Changer l&apos;image
        </Button>
        {isUploaded && (
          <Button variant="glass" size="sm" disabled={busy} onClick={restore}>
            {busy && !source ? "..." : "Revenir à l'image de la vidéo"}
          </Button>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept={ACCEPTED.join(",")} onChange={pickFile} className="hidden" />

      {/* Recadrage plein ecran. Porte dans <body> : un ancetre en verre
          (backdrop-filter) deviendrait sinon le bloc conteneur de ce position: fixed. */}
      {source && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Recadrer l'image du film" className="fixed inset-0 z-[9999] flex flex-col bg-black">
          <div className="relative flex-1">
            <Cropper
              image={source}
              crop={crop}
              zoom={zoom}
              aspect={16 / 9}
              cropShape="rect"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          <div className="glass-strong rounded-t-panel border-b-0 bg-glass-solid/85 px-5 pt-4 pb-[calc(20px+env(safe-area-inset-bottom,0px))]">
            <div className="mx-auto w-full max-w-[420px]">
              <label htmlFor={zoomId} className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.08em] text-text-secondary">ZOOM</label>
              <input
                id={zoomId}
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="mb-4 h-11 w-full accent-lime"
              />

              {error && <div className="mb-3"><Note>{error}</Note></div>}

              <div className="flex gap-2.5">
                <Button variant="glass" onClick={closeCrop} disabled={busy} className="flex-1">
                  Annuler
                </Button>
                <Button onClick={apply} disabled={busy || !area} className="flex-1">
                  {busy ? "Envoi..." : "Appliquer"}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
