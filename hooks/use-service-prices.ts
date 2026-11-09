"use client";

import {useEffect, useState} from "react";
import {services, withServicePrices, type ServicePrice} from "@/lib/catalog";

export function useServicePrices() {
  const [catalogue, setCatalogue] = useState(services);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/workshop?action=prices", {signal:controller.signal})
      .then(async response => {
        if (!response.ok) return;
        const {prices} = await response.json<{prices:ServicePrice[]}>();
        if (!controller.signal.aborted) setCatalogue(withServicePrices(prices));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return catalogue;
}
