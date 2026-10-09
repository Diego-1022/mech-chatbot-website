"use client";

import { useEffect, useId, useState } from "react";
import { ImagePlus, Camera, X, Download, ImageOff, LoaderCircle } from "lucide-react";
import { MAX_BOOKING_PHOTOS, PHOTO_ACCEPT, photoErrorText, validatePhotoFile, photoMime, detectPhotoMime, mimeMatches, type BookingPhoto } from "@/lib/booking-photos";
import type { Lang } from "@/lib/catalog";

export type SelectedPhoto = { id: string; file: File };
function SelectedThumbnail({ photo, lang }: { photo: SelectedPhoto; lang: Lang }) {
  const [url] = useState(() => URL.createObjectURL(photo.file));
  const [failed, setFailed] = useState(false);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <div className="photo-thumbnail">{failed ? <ImageOff size={28} aria-hidden="true" /> : <img src={url} alt={photo.file.name} loading="lazy" decoding="async" onError={() => setFailed(true)} />}{failed && <span>{lang === "zh" ? "此格式暂无预览" : "No preview for this format"}</span>}</div>;
}
export function PhotoSelection({ photos, onChange, onCheckingChange, lang, disabled = false }: { photos: SelectedPhoto[]; onChange: (photos: SelectedPhoto[]) => void; onCheckingChange?: (checking: boolean) => void; lang: Lang; disabled?: boolean }) {
  const t = (zh: string, en: string) => lang === "zh" ? zh : en;
  const id = useId(); const [error, setError] = useState(""); const [dragging, setDragging] = useState(false); const [checking, setChecking] = useState(false);
  async function add(files: FileList | File[] | null) {
    if (!files || disabled || checking) return;
    setError("");
    const selected = Array.from(files);
    if (!selected.length) return;
    try {
      if (selected.length + photos.length > MAX_BOOKING_PHOTOS) throw new Error("TOO_MANY_IMAGES");
      selected.forEach(validatePhotoFile);
      setChecking(true); onCheckingChange?.(true);
      for (const file of selected) { const detected = detectPhotoMime(new Uint8Array(await file.slice(0, 128).arrayBuffer())); if (!detected || !mimeMatches(photoMime(file), detected)) throw new Error("INVALID_IMAGE_TYPE"); }
      onChange([...photos, ...selected.map(file => ({ id: crypto.randomUUID(), file }))]);
    } catch (error) { setError((error as Error).message); }
    finally { setChecking(false); onCheckingChange?.(false); }
  }
  return <fieldset className="booking-photo-picker" disabled={disabled || checking} aria-busy={checking}>
    <legend>{t("车辆照片（选填）", "Vehicle photos (optional)")}</legend>
    <p className="photo-limit" id={`${id}-limit`}>{t("最多 2 张，每张不超过 20 MB。可添加故障灯、零部件或车辆状况照片。", "Up to 2 images, 20 MB each. Add warning lights, parts or vehicle-condition photos.")}</p>
    <div className={`photo-dropzone${dragging ? " is-dragging" : ""}`} onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); add(event.dataTransfer.files); }}>
      <ImagePlus size={27} aria-hidden="true" /><p>{t("选择图片，或将图片拖到这里", "Choose images or drop them here")}</p>
      <div className="photo-actions"><label className={`secondary photo-select-button${photos.length >= MAX_BOOKING_PHOTOS ? " is-disabled" : ""}`}><ImagePlus size={16} aria-hidden="true" />{t("选择图片", "Choose images")}<input className="photo-file-input" type="file" accept={PHOTO_ACCEPT} multiple aria-label={t("选择车辆图片", "Choose vehicle images")} aria-describedby={`${id}-limit`} disabled={disabled || photos.length >= MAX_BOOKING_PHOTOS} onChange={event => { add(event.target.files); event.target.value = ""; }} /></label><label className="secondary photo-camera-button"><Camera size={16} aria-hidden="true" />{t("拍照", "Take a photo")}<input className="photo-file-input" type="file" accept="image/*" capture="environment" aria-label={t("拍摄车辆照片", "Take a vehicle photo")} disabled={disabled || photos.length >= MAX_BOOKING_PHOTOS} onChange={event => { add(event.target.files); event.target.value = ""; }} /></label></div>
    </div>
    <p className="photo-count">{photos.length} / {MAX_BOOKING_PHOTOS} {t("张图片", "images")}</p>
    {checking && <p className="small" role="status">{t("正在检查图片…", "Checking images…")}</p>}
    {photos.length > 0 && <div className="selected-photo-grid">{photos.map(photo => <article className="selected-photo" key={photo.id}><SelectedThumbnail photo={photo} lang={lang} /><div className="selected-photo-info"><strong title={photo.file.name}>{photo.file.name}</strong><span>{(photo.file.size / (1024 * 1024)).toFixed(2)} MB</span></div><button className="photo-remove" type="button" disabled={disabled} aria-label={t("移除图片 ", "Remove image ") + photo.file.name} onClick={() => { setError(""); onChange(photos.filter(item => item.id !== photo.id)); }}><X size={16} /></button></article>)}</div>}
    {error && <p className="error" role="alert">{photoErrorText(error, lang)}</p>}
    <p className="photo-privacy">{t("图片只供你和店铺管理员查看；提交预约后上传。支持 JPG、PNG、WebP、GIF、AVIF、HEIC/HEIF。", "Images are private to you and the workshop administrator, and upload after booking confirmation. JPG, PNG, WebP, GIF, AVIF and HEIC/HEIF supported.")}</p>
  </fieldset>;
}
export function PhotoReview({ photos, lang }: { photos: SelectedPhoto[]; lang: Lang }) {
  if (!photos.length) return null;
  return <div className="photo-review"><h3>{lang === "zh" ? "附加图片" : "Attached images"} ({photos.length}/2)</h3><div className="selected-photo-grid">{photos.map(photo => <article className="selected-photo" key={photo.id}><SelectedThumbnail photo={photo} lang={lang} /><div className="selected-photo-info"><strong>{photo.file.name}</strong><span>{(photo.file.size / (1024 * 1024)).toFixed(2)} MB</span></div></article>)}</div></div>;
}
export function PhotoGallery({ photos, token, lang }: { photos: BookingPhoto[]; token?: string; lang: Lang }) {
  const [open, setOpen] = useState(false);
  if (!photos.length) return null;
  return <section className="private-photo-gallery"><button className="secondary" type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}><ImagePlus size={17} />{open ? (lang === "zh" ? "收起图片" : "Hide images") : (lang === "zh" ? "查看预约图片" : "View booking images")} ({photos.length})</button>{open && <div className="private-photo-grid">{photos.map(photo => <PrivatePhoto key={photo.id} photo={photo} token={token} lang={lang} />)}</div>}</section>;
}
function PrivatePhoto({ photo, token, lang }: { photo: BookingPhoto; token?: string; lang: Lang }) {
  const [url, setUrl] = useState(""); const [error, setError] = useState(""); const [retry, setRetry] = useState(0); const [previewFailed, setPreviewFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); let objectUrl = "";
    fetch(`/api/booking-photos?booking=${encodeURIComponent(photo.booking_id)}&image=${encodeURIComponent(photo.id)}`, { headers: token ? { Authorization: "Bearer " + token } : {}, signal: controller.signal })
      .then(async response => { if (!response.ok) { const result = await response.json() as { error?: string }; throw new Error(result.error || "UNAVAILABLE"); } return response.blob(); })
      .then(blob => { if (controller.signal.aborted) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); setError(""); })
      .catch(error => { if (!controller.signal.aborted) setError((error as Error).message); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photo.booking_id, photo.id, token, retry]);
  return <article className="private-photo"><div className="photo-thumbnail">{url && !previewFailed ? <img src={url} alt={photo.name} loading="lazy" decoding="async" onError={() => setPreviewFailed(true)} /> : error || previewFailed ? <ImageOff size={28} aria-hidden="true" /> : <LoaderCircle size={24} className="photo-spinner" aria-label={lang === "zh" ? "正在读取图片" : "Loading image"} />}</div><strong>{photo.name}</strong><span>{(photo.size / (1024 * 1024)).toFixed(2)} MB</span>{error && <><p className="small">{photoErrorText(error, lang)}</p><button type="button" className="link" onClick={() => { setError(""); setRetry(value => value + 1); }}>{lang === "zh" ? "重新读取" : "Retry image"}</button></>}{previewFailed && <p className="small">{lang === "zh" ? "此浏览器无法预览该格式，可以下载原图。" : "This browser cannot preview this format. Download the original image."}</p>}{url && <a href={url} download={photo.name} className="photo-download"><Download size={15} aria-hidden="true" />{lang === "zh" ? "下载原图" : "Download original"}</a>}</article>;
}
