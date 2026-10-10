"use client";

import { useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { canvasToWebpBlob, MAX_INPUT_BYTES } from "@/lib/image-compress";
import Button from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";

interface Props {
  currentAvatarUrl: string | null;
  onUploadComplete: (url: string) => void;
  initials: string;
  size?: number;
}

export default function AvatarUpload({ currentAvatarUrl, onUploadComplete, initials, size = 96 }: Props) {
  const [showSheet, setShowSheet] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pressedOnBackdrop = useRef(false);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function handleSource(source: "camera" | "gallery") {
    setShowSheet(false);

    try {
      // Try Capacitor Camera first (native)
      const { Camera, CameraSource, CameraResultType } = await import("@capacitor/camera");
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
        width: 800,
        height: 800,
      });
      if (image.dataUrl) {
        setImageToCrop(image.dataUrl);
      }
    } catch {
      // Fallback: file input (web)
      if (fileInputRef.current) {
        fileInputRef.current.accept = "image/*";
        if (source === "camera") fileInputRef.current.capture = "environment";
        else fileInputRef.current.removeAttribute("capture");
        fileInputRef.current.click();
      }
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Plafond dur EN ENTRÉE : on bloque l'absurde avant tout traitement.
    if (file.size > MAX_INPUT_BYTES) {
      showToast("Image trop lourde (10 Mo maximum).");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageToCrop(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function applyCrop() {
    if (!imageToCrop || !croppedAreaPixels) return;
    setUploading(true);

    try {
      // Create cropped image
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const image = new Image();
      image.crossOrigin = "anonymous";

      await new Promise<void>((resolve) => {
        image.onload = () => resolve();
        image.src = imageToCrop;
      });

      // Sortie optimisée : 512×512 WebP q0.8 (≈ 30–60 Ko). Le recadrage produit
      // déjà un carré, on ré-encode juste en WebP via l'util partagé.
      canvas.width = 512;
      canvas.height = 512;

      ctx.drawImage(
        image,
        croppedAreaPixels.x, croppedAreaPixels.y,
        croppedAreaPixels.width, croppedAreaPixels.height,
        0, 0, 512, 512
      );

      const blob = await canvasToWebpBlob(canvas, 0.8);

      // Upload via API route (bypasses RLS issues on mobile)
      const formData = new FormData();
      formData.append("file", blob, "avatar.webp");

      const res = await fetch("/api/avatar", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Upload failed");

      const url = data.url;

      onUploadComplete(url);
      setImageToCrop(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      showToast("Photo mise a jour");
    } catch (err) {
      showToast("Erreur lors de l'upload");
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    setShowSheet(false);
    await fetch("/api/avatar", { method: "DELETE" });
    onUploadComplete("");
    showToast("Photo supprimee");
  }

  const sheetRow =
    "flex min-h-14 w-full items-center gap-3 rounded-card border border-white/10 bg-white/5 px-4 text-left text-sm hover:border-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime";

  return (
    <>
      {/* Avatar circle */}
      <button
        type="button"
        aria-label="Changer la photo de profil"
        onClick={() => setShowSheet(true)}
        className="group relative shrink-0 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime"
        style={{ width: size, height: size }}
      >
        <span className="relative block size-full overflow-hidden rounded-full border-2 border-lime/35 bg-white/5 shadow-[0_0_0_5px_rgba(200,255,0,0.06),0_0_40px_rgba(200,255,0,0.25)]">
          {currentAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentAvatarUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center font-semibold text-lime" style={{ fontSize: size * 0.3 }}>
              {initials}
            </span>
          )}
          {/* Overlay */}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-active:opacity-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </span>
        </span>
        {/* Pastille appareil photo : rend l'action visible au tactile (pas de survol) */}
        <span className="btn-accent absolute -bottom-0.5 -right-0.5 flex size-7 items-center justify-center" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </span>
      </button>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileSelect} />

      {/* Bottom sheet. Portee dans <body> : un ancetre en verre (backdrop-filter) deviendrait
          sinon le bloc conteneur de ce position: fixed. Fermeture au clic sur le fond
          seulement si mousedown ET mouseup y ont lieu. */}
      {showSheet && createPortal(
        <div
          onMouseDown={(e) => { pressedOnBackdrop.current = e.target === e.currentTarget; }}
          onClick={(e) => { if (e.target === e.currentTarget && pressedOnBackdrop.current) setShowSheet(false); }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-sheet-title"
            className="glass-strong flex w-full max-w-[420px] flex-col gap-2.5 rounded-t-panel border-b-0 bg-glass-solid/85 px-5 pt-6 pb-[calc(20px+env(safe-area-inset-bottom,0px))] sm:rounded-panel sm:border-b sm:pb-5"
          >
            <h3 id="avatar-sheet-title" className="mb-2 text-base font-semibold text-text-primary">Photo de profil</h3>

            <button type="button" onClick={() => handleSource("camera")} className={`${sheetRow} text-text-primary`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="shrink-0 text-lime" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
              Prendre une photo
            </button>

            <button type="button" onClick={() => handleSource("gallery")} className={`${sheetRow} text-text-primary`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-lime" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
              Choisir dans la galerie
            </button>

            {currentAvatarUrl && (
              <button type="button" onClick={handleDelete} className={`${sheetRow} border-red-500/20! bg-red-500/5! text-red-400`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                Supprimer la photo
              </button>
            )}

            <Button variant="glass" onClick={() => setShowSheet(false)} className="mt-1 w-full">
              Annuler
            </Button>
          </div>
        </div>,
        document.body
      )}

      {/* Cropper fullscreen */}
      {imageToCrop && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-black pt-[env(safe-area-inset-top,0px)]">
          <div className="relative flex-1">
            <Cropper
              image={imageToCrop}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          <div className="glass-strong rounded-t-panel border-b-0 bg-glass-solid/85 px-5 pt-4 pb-[calc(20px+env(safe-area-inset-bottom,0px))]">
            <div className="mx-auto w-full max-w-[420px]">
              <label htmlFor="avatar-zoom" className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.08em] text-text-secondary">ZOOM</label>
              <input
                id="avatar-zoom"
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="mb-4 h-11 w-full accent-lime"
              />

              <div className="flex gap-2.5">
                <Button
                  variant="glass"
                  onClick={() => { setImageToCrop(null); setCrop({ x: 0, y: 0 }); setZoom(1); }}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button onClick={applyCrop} disabled={uploading} className="flex-1">
                  {uploading ? "Upload..." : "Appliquer"}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <Toast message={toast} />
    </>
  );
}
