import {z} from "zod";
import {type Lang} from "./catalog";
import {AIError, MODEL} from "./openai-assistant";
import {type FinancialAnalysis} from "./workshop-financials";

const points = z.array(z.string().trim().min(1).max(450)).min(1).max(3);
const analysisSchema = z.object({
  summary:z.string().trim().min(1).max(650),
  observations:points,
  recommendations:points,
}).strict();

export async function analyseFinancials(
  key:string, lang:Lang, snapshot:object, fetcher:typeof fetch=fetch,
):Promise<FinancialAnalysis> {
  const language = lang === "zh" ? "Simplified Chinese" : "English";
  const instructions = [
    "Write a brief operational review for the administrator of an automotive workshop.",
    "Write in "+language+" and use the supplied aggregate data only. Use plain text within the JSON fields.",
    "Distinguish recorded receipts by payment date, confirmed visits by appointment date, and pending requests by appointment date.",
    "Booking ranges are current catalogue estimates, not quotes, realised revenue or guarantees. Never add them to receipts or treat pending requests as sales.",
    "A zero receipt count means no receipts were entered, not that the workshop made no sales.",
    "The selected month may be incomplete. Do not infer growth, conversion, causation, costs, margins or profit from this snapshot.",
    "Keep the summary short. Give 1 to 3 grounded observations and 1 to 3 specific follow-up actions appropriate for the data.",
    "For sparse data, state the limitation and suggest what the administrator can check or record next.",
  ].join(" ");

  try {
    const response = await fetcher("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:MODEL,
        store:false,
        max_output_tokens:950,
        instructions,
        input:JSON.stringify(snapshot),
        text:{format:{
          type:"json_schema", name:"workshop_financial_analysis", strict:true,
          schema:{
            type:"object",additionalProperties:false,
            properties:{
              summary:{type:"string"},
              observations:{type:"array",items:{type:"string"}},
              recommendations:{type:"array",items:{type:"string"}},
            },
            required:["summary","observations","recommendations"],
          },
        }},
      }),
      signal:AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new AIError(response.status===429?"AI_BUSY":"AI_UNAVAILABLE");

    type OutputItem = {type:string;content?:{type:string;text?:string}[]};
    const body = await response.json() as {status?:string;output?:OutputItem[]};
    if (body.status !== "completed") throw new AIError("AI_UNAVAILABLE");
    const output = body.output?.filter(item=>item.type==="message").flatMap(item=>item.content??[]);
    if (output?.some(item=>item.type==="refusal")) throw new AIError("AI_UNAVAILABLE");
    const text = output?.filter(item=>item.type==="output_text").map(item=>item.text).join("");
    return analysisSchema.parse(JSON.parse(text??""));
  } catch(error) {
    if (error instanceof AIError) throw error;
    throw new AIError("AI_UNAVAILABLE");
  }
}
