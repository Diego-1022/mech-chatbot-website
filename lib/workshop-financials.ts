import {withServicePrices, type ServicePrice} from "./catalog";

export type FinancialSummary = {
  prices: ServicePrice[];
  receipts: {count:number; cents:number};
  forecast: {service:string; status:"requested" | "confirmed"; count:number}[];
};

export function bookingEstimate(summary: FinancialSummary, status: "requested" | "confirmed") {
  const catalogue = withServicePrices(summary.prices);
  const estimate = {low:0,high:0,count:0,unpricedCount:0};
  for (const row of summary.forecast) {
    if (row.status !== status) continue;
    const service = catalogue.find(item=>item.id===row.service);
    if (!service) {
      estimate.unpricedCount += row.count;
      continue;
    }
    estimate.low += service.min * row.count;
    estimate.high += service.max * row.count;
    estimate.count += row.count;
  }
  return estimate;
}

export type FinancialAnalysis = {summary:string; observations:string[]; recommendations:string[]};
