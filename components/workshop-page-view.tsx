"use client";

import {useEffect} from "react";
import {usePathname} from "next/navigation";
import {trackedPages} from "@/lib/workshop-analytics";

export function WorkshopPageView() {
  const pathname=usePathname();
  useEffect(() => {
    if (!trackedPages.some(page=>page===pathname)) return;
    void fetch("/api/workshop", {
      method:"POST", headers:{"Content-Type":"application/json"}, keepalive:true,
      body:JSON.stringify({action:"pageView",page:pathname}),
    }).catch(()=>{});
  }, [pathname]);
  return null;
}
