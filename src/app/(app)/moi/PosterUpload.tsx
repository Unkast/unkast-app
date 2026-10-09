"use client";
// Image d'un film : consignes, apercu, envoi d'une image recadree en 16:9 (compressee
// dans le navigateur) avec apercu en direct, retour a l'image de la video.
// POST / DELETE /api/projects/[id]/poster
import { useCallback, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { canvasToWebpBlob } from "@/lib/image-compress";
import FilmPoster from "@/components/FilmPoster";
import Button from "@/components/ui/Button";
import { Note } from "./parts";
import { callApi, type ManagedProject, type ShowToast } from "./api";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
// Sortie : 1920 x 1080 au plus (taille ideale annoncee), jamais agrandie.
const OUT_WIDTH = 1920;
const QUALITY = 0.82;
// En dessous, l'image est acceptee mais un avertissement donne ses dimensions.
const MIN_WIDTH = 1280;
const MIN_HEIGHT = 720;
// Une image envoyee vit dans le bucket public « posters ».
const UPLOADED_MARK = "/storage/v1/object/public/posters/";

const helpCls = "text-xs leading-relaxed text-text-secondary";
const warnCls = "text-xs leading-relaxed text-[#f97316]";
const BAR = "rounded-sm bg-white/15";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image illisible."));
    img.src = src;
  });
}

// Partie de l'image retenue par le recadrage, affichee dans un cadre 16:9.
// `area` est en pourcentages de l'image (react-easy-crop).
function CropPreview({ source, area, className = "" }: { source: string; area: Area | null; className?: string }) {
  return (
    <div className={`relative aspect-video w-full overflow-hidden bg-glass-solid ${className}`}>
      {area && area.width > 0 && area.height > 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source}
          alt=""
          className="absolute max-w-none"
          style={{
            width: `${10000 / area.width}%`,
            height: `${10000 / area.height}%`,
            left: `${(-area.x / area.width) * 100}%`,
            top: `${(-area.y / area.height) * 100}%`,
          }}
        />
      )}
    </div>
  );
}

// Les trois endroits ou l'image apparait, en miniature : petite carte du feed, bloc
// « À la une », page du film. Mis a jour pendant le recadrage.
function LivePreviews({ source, area }: { source: string; area: Area | null }) {
  const label = "mt-1.5 text-center text-[10px] leading-tight text-text-secondary";
  return (
    <div className="mb-4 grid grid-cols-3 items-start gap-3" aria-hidden="true">
      <div>
        <div className="mx-auto w-4/5">
          <CropPreview source={source} area={area} className="rounded-[5px]" />
          <div className={`mt-1.5 h-1.5 w-3/4 ${BAR}`} />
          <div className={`mt-1 h-1 w-1/2 ${BAR} opacity-60`} />
        </div>
        <p className={label}>Petite carte</p>
      </div>
      <div>
        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] p-1.5">
          <div className="flex w-2/5 flex-col gap-1">
            <div className={`h-2 w-full ${BAR}`} />
            <div className={`h-1 w-3/4 ${BAR} opacity-60`} />
            <div className="mt-0.5 h-1.5 w-1/2 rounded-pill bg-lime" />
          </div>
          <div className="w-3/5">
            <CropPreview source={source} area={area} className="rounded-[4px]" />
          </div>
        </div>
        <p className={label}>À la une</p>
      </div>
      <div>
        <div className="relative">
          <CropPreview source={source} area={area} className="rounded-md" />
          <span className="absolute left-1/2 top-1/2 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-pill bg-black/45">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </div>
        <div className={`mt-1.5 h-2 w-2/3 ${BAR}`} />
        <p className={label}>Page du film</p>
      </div>
    </div>
  );
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
  // URL locale (blob:) de l'image en cours de recadrage, et ses dimensions reelles.
  const [source, setSource] = useState<string | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // Zone retenue : en pixels (envoi) et en pourcentages (apercus en direct).
  const [area, setArea] = useState<Area | null>(null);
  const [percentArea, setPercentArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zoomId = useId();

  const url = `/api/projects/${project.id}/poster`;
  const isUploaded = Boolean(project.poster_url?.includes(UPLOADED_MARK));
  const isVertical = Boolean(dims && dims.height > dims.width);
  const isSmall = Boolean(dims && (dims.width < MIN_WIDTH || dims.height < MIN_HEIGHT));

  const onCropAreaChange = useCallback((percent: Area, pixels: Area) => {
    setPercentArea(percent);
    setArea(pixels);
  }, []);

  function closeCrop() {
    if (source) URL.revokeObjectURL(source);
    setSource(null);
    setDims(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    setPercentArea(null);
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
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
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await loadImage(objectUrl);
      setDims({ width: image.naturalWidth, height: image.naturalHeight });
    } catch {
      URL.revokeObjectURL(objectUrl);
      setError("Image illisible. Essaie avec un autre fichier.");
      return;
    }
    setError("");
    setSource(objectUrl);
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
      <div className="w-full max-w-sm">
        {project.poster_url ? (
          <FilmPoster src={project.poster_url} alt={`Image du film ${project.title}`} sizes="384px" framed className="rounded-media border border-white/10" />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-media border border-white/10 bg-white/5">
            <p className={helpCls}>Aucune image</p>
          </div>
        )}
      </div>

      {/* Consignes, visibles avant le choix du fichier */}
      <p className={helpCls}>
        Format horizontal 16:9. Idéal 1920 × 1080 px, minimum 1280 × 720 px. JPG, PNG ou WebP, 5 Mo max.
        Garde le titre et les visages vers le centre, évite le texte collé aux bords.
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

      <p className={helpCls}>Sans image, on utilise celle de ta vidéo YouTube ou Vimeo.</p>

      <input ref={fileInputRef} type="file" accept={ACCEPTED.join(",")} onChange={pickFile} className="hidden" />

      {/* Recadrage plein ecran. Porte dans <body> : un ancetre en verre
          (backdrop-filter) deviendrait sinon le bloc conteneur de ce position: fixed. */}
      {source && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Recadrer l'image du film" className="fixed inset-0 z-[9999] flex flex-col bg-black">
          <div className="relative min-h-[160px] flex-1">
            <Cropper
              image={source}
              crop={crop}
              zoom={zoom}
              aspect={16 / 9}
              cropShape="rect"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropAreaChange={onCropAreaChange}
            />
          </div>

          <div className="glass-strong max-h-[70dvh] overflow-y-auto rounded-t-panel border-b-0 bg-glass-solid/85 px-5 pt-4 pb-[calc(20px+env(safe-area-inset-bottom,0px))]">
            <div className="mx-auto w-full max-w-[420px]">
              {(isVertical || isSmall) && (
                <div className="mb-3 flex flex-col gap-1.5" role="status">
                  {isVertical && (
                    <p className={warnCls}>Les affiches verticales ne sont pas prises en charge, choisis la partie horizontale à garder.</p>
                  )}
                  {isSmall && dims && (
                    <p className={warnCls}>
                      Image petite : {dims.width} × {dims.height} px, pour un minimum conseillé de {MIN_WIDTH} × {MIN_HEIGHT} px. Elle risque d&apos;être floue en grand, tu peux quand même l&apos;envoyer.
                    </p>
                  )}
                </div>
              )}

              {/* Apercu en direct du recadrage */}
              <LivePreviews source={source} area={percentArea} />

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
