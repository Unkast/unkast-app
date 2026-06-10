"use client";

import { useState, useCallback, useRef } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

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

      canvas.width = 400;
      canvas.height = 400;

      ctx.drawImage(
        image,
        croppedAreaPixels.x, croppedAreaPixels.y,
        croppedAreaPixels.width, croppedAreaPixels.height,
        0, 0, 400, 400
      );

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85);
      });

      if (!blob) throw new Error("Failed to create blob");

      // Upload via API route (bypasses RLS issues on mobile)
      const formData = new FormData();
      formData.append("file", blob, "avatar.jpg");

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

  return (
    <>
      {/* Avatar circle */}
      <div
        onClick={() => setShowSheet(true)}
        style={{ width: size, height: size, borderRadius: "50%", position: "relative", cursor: "pointer", overflow: "hidden", flexShrink: 0 }}
      >
        {currentAvatarUrl ? (
          <img src={currentAvatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "rgba(200,255,0,0.08)", border: "1.5px solid rgba(200,255,0,0.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: size * 0.3, fontWeight: 600, color: "#C8FF00" }}>{initials}</span>
          </div>
        )}
        {/* Overlay */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 200ms" }} className="avatar-upload-overlay">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>
        <style>{`.avatar-upload-overlay:hover, .avatar-upload-overlay:active { opacity: 1 !important; }`}</style>
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileSelect} />

      {/* Bottom sheet */}
      {showSheet && (
        <div onClick={() => setShowSheet(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a1a1a", borderRadius: "20px 20px 0 0", padding: "24px 20px 32px", width: "100%", maxWidth: 420 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 20 }}>Photo de profil</h3>

            <button onClick={() => handleSource("camera")} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: 16, background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "none", cursor: "pointer", marginBottom: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
              <span style={{ fontSize: 14, color: "#f0f0f0" }}>Prendre une photo</span>
            </button>

            <button onClick={() => handleSource("gallery")} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: 16, background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "none", cursor: "pointer", marginBottom: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8FF00" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
              <span style={{ fontSize: 14, color: "#f0f0f0" }}>Choisir dans la galerie</span>
            </button>

            {currentAvatarUrl && (
              <button onClick={handleDelete} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: 16, background: "rgba(239,68,68,0.05)", borderRadius: 12, border: "none", cursor: "pointer", marginBottom: 10 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                <span style={{ fontSize: 14, color: "#ef4444" }}>Supprimer la photo</span>
              </button>
            )}

            <button onClick={() => setShowSheet(false)} style={{ width: "100%", padding: 14, background: "none", border: "none", color: "#555", fontSize: 14, cursor: "pointer", marginTop: 4 }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Cropper fullscreen */}
      {imageToCrop && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#000", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, position: "relative" }}>
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

          <div style={{ background: "rgba(0,0,0,0.8)", padding: "16px 20px 24px" }}>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#555", marginBottom: 6, letterSpacing: "0.08em" }}>ZOOM</p>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#C8FF00" }}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setImageToCrop(null); setCrop({ x: 0, y: 0 }); setZoom(1); }}
                style={{ flex: 1, padding: 13, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#f0f0f0", fontSize: 14, cursor: "pointer" }}
              >
                Annuler
              </button>
              <button
                onClick={applyCrop}
                disabled={uploading}
                style={{ flex: 1, padding: 13, background: "#C8FF00", color: "#0d0d0d", fontWeight: 600, fontSize: 14, borderRadius: 10, border: "none", cursor: "pointer", opacity: uploading ? 0.6 : 1 }}
              >
                {uploading ? "Upload..." : "Appliquer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 50, padding: "10px 16px", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 13, color: "#f0f0f0" }}>
          {toast}
        </div>
      )}
    </>
  );
}
