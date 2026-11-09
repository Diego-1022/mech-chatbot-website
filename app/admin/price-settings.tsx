"use client";

import {useEffect, useState, type FormEvent} from "react";
import {api, errorText} from "@/lib/client";
import {services, withServicePrices, type Lang, type ServicePrice} from "@/lib/catalog";

export function PriceSettings({lang, onSaved}: {lang:Lang; onSaved:()=>void}) {
  const t = (zh:string,en:string) => lang === "zh" ? zh : en;
  const [catalogue,setCatalogue] = useState<typeof services | null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [saved,setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/workshop?action=prices",{signal:controller.signal}).then(async response => {
      if (!response.ok) throw new Error("UNAVAILABLE");
      const {prices} = await response.json<{prices:ServicePrice[]}>();
      if (!controller.signal.aborted) setCatalogue(withServicePrices(prices));
    }).catch(() => {if (!controller.signal.aborted) setError("UNAVAILABLE");});
    return () => controller.abort();
  }, []);

  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data=new FormData(event.currentTarget);
    const prices=services.map(({id})=>({service:id,min:Number(data.get(id+"-min")),max:Number(data.get(id+"-max"))}));
    setSaved(false);
    if (prices.some(row=>row.min>row.max)) {
      setError("PRICE_RANGE");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await api("adminPrices",{prices});
      setCatalogue(withServicePrices(prices));
      setSaved(true);
      onSaved();
    } catch(e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <details className="panel">
    <summary>{t("编辑服务参考价格","Edit service estimates")}</summary>
    <p className="small muted">{t("以整澳元填写每项服务的最低和最高参考价。","Enter the low and high estimates for each service in whole Australian dollars.")}</p>
    {error && <p className="error" role="alert">{error==="PRICE_RANGE" ? t("最低价格不能高于最高价格。","The low estimate must be at or below the high estimate.") : errorText(error,lang)}</p>}
    {saved && <p className="notice" role="status">{t("参考价格已发布。","Service estimates published.")}</p>}
    {catalogue && <form onSubmit={save} onChange={()=>setSaved(false)}>
      <fieldset disabled={busy}>
        {catalogue.map(item=><fieldset key={item.id}>
          <legend>{item[lang]}</legend>
          <div className="workshop-form-grid">
            <label className="field">{t("最低价（澳元）","Low (AUD)")}
              <input name={item.id+"-min"} type="number" min="0" max="1000000" step="1" defaultValue={item.min} required/>
            </label>
            <label className="field">{t("最高价（澳元）","High (AUD)")}
              <input name={item.id+"-max"} type="number" min="0" max="1000000" step="1" defaultValue={item.max} required/>
            </label>
          </div>
        </fieldset>)}
        <button className="primary">{t("发布参考价格","Publish estimates")}</button>
      </fieldset>
    </form>}
  </details>;
}
