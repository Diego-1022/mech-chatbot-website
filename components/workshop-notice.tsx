"use client";

import {useEffect, useState} from "react";
import type {Lang} from "@/lib/catalog";

export type NoticeText = {en: string; zh: string};

export async function readWorkshopNotice(signal?: AbortSignal): Promise<NoticeText> {
  const response = await fetch("/api/workshop?action=notice", {signal});
  if (!response.ok) throw new Error("UNAVAILABLE");
  const {notice} = await response.json<{notice:NoticeText}>();
  return notice;
}

export default function WorkshopNotice({lang}: {lang: Lang}) {
  const [notice, setNotice] = useState<NoticeText>();
  useEffect(() => {
    const controller = new AbortController();
    readWorkshopNotice(controller.signal).then(setNotice).catch(() => {});
    return () => controller.abort();
  }, []);
  if (!notice) return null;
  const locale = notice[lang] ? lang : lang === "en" ? "zh" : "en";
  if (!notice[locale]) return null;
  return <aside className="workshop-notice" aria-label={lang === "zh" ? "营业公告" : "Workshop notice"}>
    <strong>{lang === "zh" ? "营业公告" : "Workshop notice"}</strong>
    <p lang={locale}>{notice[locale]}</p>
  </aside>;
}
