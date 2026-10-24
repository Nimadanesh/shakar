import { it, expect } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizeForMatch } from "@/lib/persianNormalize";
import { resolveHuntDefinition } from "./definition";
import { collectCandidates, confirmCandidates, type HuntEvent } from "./pipeline";
function roleCue(title:string):"mixed"|"buyer"|"seller"|"other"{const t=normalizeForMatch(title);const b=/خریدار|خریدارم|خریداریم|خرید|می\s?خرم|می\s?خوام|می\s?خواهم/.test(t);const s=/فروش|فروشی|فروشنده|به\s?فروش/.test(t);return b&&s?"mixed":b?"buyer":s?"seller":"other";}
const previouslyInspectedIds = new Set([
      "gab_aV8W", "gaLNJNwu", "ga4iPfzH", "gaPHaEfq", "gaRj-fI_", "gaqV1O58",
      "galu34HS", "gavSad4q", "Qa4_oh_e", "gabPa811", "gaIL7h0B",
      "gaYvJrs6", "wZcsAVgg", "gab7Jmnv", "gabLLuzd", "gaP28UXT",
      // Exclude every listing already opened during the 2026-10-24 diagnostic captures.
      "gac_yx5p", "ga9Nx1wE", "gaFLygmQ", "gab7c23g", "gac7yxi1",
      "gajmIwfW", "gaQjucWz", "QaPvpvjd", "gaVXpJTP", "gaWDC3Xz",
      "gaf4cqwp", "gaU-i7iQ", "gac3hpjw", "gaAnK9CM", "gaA_eiS8",
      // Exclude every listing inspected in the reordered 2026-10-24 capture artifacts.
      "gaQ7okv9", "gaNhm4BK", "ga1M_D8i", "gac7D9Tv", "gaMPHkWW",
      "gaanVfX4", "gacLUYlL", "gaaPW6zt", "Aa5suyBE", "gajmIwfW",
      "gacjTTyh", "gayVhzOr", "gaSLpCEY",
      // Exclude all newly inspected IDs from the retargeted 2026-10-24 captures.
      "gavBLU60", "gaVn-dm2", "gabvBEiY", "ga7dAoCa", "gaKufbEV", "gabP-8po",
      "gaVP5Rtf", "gaXTjbv8", "gaTI-Kn3", "Qa8HqiWJ",
      // IDs inspected in the retargeted-v2 captures (commit 49a564a).
      "gac7TJRT", "gabzLV7f", "QaoPqC7X", "gaO7GNJh", "gaE5qO5h",
      "gabjtdOw", "gaay7dtd", "gaDkHop1", "gayyxUTa", "gaMPHkWW",
      "gajmIwfW", "gacjTTyh", "gaSLpCEY",
      // IDs opened by the cross-category exclusion-validation run.
      "gaZ6xXmW", "gaIL7h0B", "gaaLQFAi", "gabztl8G", "gaUrFcFK", "gaJaHd6y",
      // Previously graded IDs from the fresh paired and cross-cell blind packets.
      "gab_ekWg", "Qa9fP53U", "gaKTlAwq", "gaaPW6zt", "gabvBEiY", "ga726UUL",
      "gacXDBWE", "gacbznRe", "wZ-6rn1v", "gacTj43d",
      // IDs inspected in the exclusion-validation captures (including parallel run overlap).
      "gacT0u2G", "garWfS78", "gaVv8W6C", "gacXDBWE", "gaFzv-Qd",
      "gahEL1JU", "gaLHWNrk", "galqJmNl", "ga4d_A6Z", "gaPfmFQa", "gaUP4Rl-", "ga9KvfNV",
      // Newly opened in cross-category exclusion-verification run 40067592333.
      "gacXU-Wj", "gaoyGo-V", "gaRS8JbI", "gacfDsAU", "gabf9GoW", "gaBO62kC", "gaczD8Wv", "gaaOqkhk", "galGk_Sk", "gab_pT7w", "gaYrXwID", "gaYX7iQb", "gaPs0wws", "gacbUjPx", "gakSO3cA", "gaFbXSvI", "gaZTNpHg", "QaYHrsIF", "gaZDO_b2",
      // Newly opened in Follow-up 03 exclusion-verification run 40067592331.
      "gaGTm9S0", "gaHJo2YL", "gayyiAZb", "gaCPUsY9", "gabPbqO1", "gaKHDJrP", "gabzNkqG",
          // Selected IDs from the verified retargeted capture 03 blind packet; never reuse in later captures.
      "gacj0uNF",
      "QaRyXg2a",
      "gaZX_Yj3",
      "gaHbT4ov",
      "gaTbR5Rb",
      "gaBPPjUm",
      "Qa0L6SxA",
      "gaU2U0Mv",
      "gaqu1hx_",
      "gaEWi1OQ",
      "gacjUsaz",
      "gaPj2RbK",
      // IDs selected by fresh diagnostic captures on 2026-10-24; keep excluded from future packets.
      "ga6CSfMM",
      "gaNc5fRN",
      "gaH0zc7w",
      "gaFHdnop",
      "gabvI8Fm",
      "gacrEnA2",
      "gaeWepTl",
      "gaUnfe_p",
      "gaE75Gsi",
      "gaNDASAL",
      "gaJ_sXNx",
      "gaaTQEb7",
      // Additional IDs from earlier bounded diagnostic captures; exclude across both capture workflows.
      "QaM0ztoJ",
      "gaN3EAVR",
      "ga2qQAPq",
      "gallxRrN",
      "AZYprmyz",
      "gacdDbtu",
      "gabKdk6q",
      "gaLHGW9W",
      "gaYz4Oi-",
      "gaVrrHpB",
      "ga5OBB6n",
      // All source IDs inspected or graded in Capture 04; never reuse them.
      "gaXXxCBa", "gacHF7dN", "AaDSxXZ8", "gaQzayLB", "gaMVLohg", "gaK92UdI",
      "gacLFEvk", "gaKeKHIz", "gacz0OBI", "gaY_7zyW", "gaOSC1Mb", "wYL_5mWC", "gaJaj2PY",
      "gac3D4fJ",
      "gaU7IS1j",
      "gaWHIDAt",
      "gacvUdQ_",
      "gabT47tX",
      "ga36JfvB",
      "gabnYS2G",
      // All selected IDs from Capture 05B; never reuse them in later captures.
      "gacXlFBL", "gazms9IA", "gacL14Hy", "QZji3t1d",
      "gaXGdt9a", "gaM76Zea", "QadoH4Gg", "QaFK7cdB",
      // Exclude every listing opened in the first, invalid-context Capture 04 attempt.
      "gaEbOtwX", "gaXy6CJ8", "gaRDeA35", "gacDldw5", "gaDn0jsk", "ga6WBlxy", "gaDZ88Mm", "gaaHGbGp",
      "gaTzFnuN", "gacHlCAO", "gaU33g50", "QaorO0r9", "gaa9oSP6", "ga-x6Euu", "gaTTRdcp", "gaXzUyYo",
      // Exclude every listing inspected in the same-query Capture 04 attempt.
      "gawRFk9i", "gacfUjkL", "gaTTl0z-", "gabDsiQo", "gaczT30z", "gaPXd9Pv",
      "gaYr2XQZ", "gaUDI9Xs", "gaoK-BMS", "gacHFp_T",
      // IDs from earlier bounded diagnostic captures; exclude across future packets.

      // Exclude every selected ID from Capture 05C, including gaACDACa that overlapped a concurrent Capture 04B rerun.
      "gaCbVWtl", "gaTPtCJY", "gacjFJlS", "ga4OPbgu", "Qa5v5zFq", "QajXepJL", "gaACDACa", "gavosQ3K",
]);
function resolve(query:string,category:string){return resolveHuntDefinition({query,include:[],exclude:[],should:[],city:"all",category,priceMin:"",priceMax:"",transaction:"",condition:""});}

function isCell(cell:string,title:string):boolean{const t=normalizeForMatch(title);const service=/تعمیر|خدمات|تعمیرکار|سرویس/.test(t);const catalyst=/کاتالیزور|کاتالیز/.test(t);const part=/موتور|گیربکس|سپر|چراغ|آینه|باتری|لاستیک|رینگ|کمک|قطعه|قطعات|اگزوز/.test(t);const whole=/خودرو|ماشین|سواری|پژو|پراید|سمند|دنا|تیبا|کوییک|ساینا|تارا|شاهین|پارس|رانا|تندر|سورن|۲۰۶|206|۲۰۷|207|۴۰۵|405|ال\s?۹۰|ال\s?90|l90|زانتیا|چری|هایما|فیدلیتی|دیگنیتی|آریزو|اطلس|نیسان|تویوتا|هیوندای|کیا|بنز|مزدا/.test(t);const year=/۱۳[۷-۹]\d|۱۴\d{2}|19\d{2}|20\d{2}/.test(t);
 if(cell==="whole-vehicle-positive")return whole&&!part&&!catalyst&&!service&&/فروش|فروشی|معاوضه|خرید/.test(t);
 if(cell==="catalyst-only-negative")return catalyst&&!service;
 if(cell==="part-service-negative")return (part||catalyst)&&service;
 if(cell==="other-part-negative")return part&&!catalyst&&!service&&!(whole&&year&&/فروش|فروشی|معاوضه|خرید/.test(t));
 return false;}
it.skipIf(process.env.LIVE_DIVAR_OBSERVATION!=="1")("Capture 05D — score unseen targeted controls under one fixed whole-car hunt",async()=>{
 const targetQuery="خرید و فروش خودرو";const category="vehicles";const targetDef=resolve(targetQuery,category);expect(targetDef).not.toBeNull();if(!targetDef)return;
 const scenarios=[{id:"whole-dena",query:"فروش دنا پلاس",cell:"whole-vehicle-positive"},{id:"whole-used",query:"خرید و فروش خودرو کارکرده",cell:"whole-vehicle-positive"},{id:"whole-toyota",query:"فروش تویوتا",cell:"whole-vehicle-positive"},{id:"catalyst-warranty",query:"فروش کاتالیزور با ضمانت",cell:"catalyst-only-negative"},{id:"catalyst-scrap-buyer",query:"خریدار کاتالیزور فرسوده",cell:"catalyst-only-negative"},{id:"catalyst-car",query:"کاتالیزور خودرو",cell:"catalyst-only-negative"},{id:"catalyst-service",query:"تعمیر کاتالیزور خودرو",cell:"part-service-negative"},{id:"spare-parts",query:"فروش لوازم یدکی خودرو",cell:"other-part-negative"}] as const;
 const reportPath=join(process.cwd(),"engine-v3-issue16-capture-05d.json");const oldBuffer=process.env.SLUG_CAPTURE_BUFFER_PATH;const oldCap=process.env.HUNT_MAX_DETAILS;process.env.SLUG_CAPTURE_BUFFER_PATH=join(process.env.RUNNER_TEMP??process.cwd(),"engine-v3-issue16-capture-05d-slugs.jsonl");process.env.HUNT_MAX_DETAILS="8";
 const seen=new Set<string>();const overlap=new Set<string>();const listings:Array<Record<string,unknown>>=[];const reports:Array<Record<string,unknown>>=[];let detailsUsed=0;
 try{for(const sc of scenarios){if(detailsUsed>=8){reports.push({id:sc.id,status:"budget-exhausted",cell:sc.cell});continue;}
  const retrievalDef=resolve(sc.query,category);expect(retrievalDef).not.toBeNull();if(!retrievalDef)continue;
  const events:HuntEvent[]=[];const {candidates,stats,endCursor}=await collectCandidates(retrievalDef,{maxPages:2,emit:e=>events.push(e)});
  const pool=candidates.filter(c=>{if(previouslyInspectedIds.has(c.sourceAdId)){overlap.add(c.sourceAdId);return false;}if(seen.has(c.sourceAdId))return false;return true;});
  const selected=pool.find(c=>isCell(sc.cell,c.title));
  if(!selected){reports.push({id:sc.id,query:sc.query,status:"missing-cell",cell:sc.cell,retrieval:{pagesCompleted:events.filter(e=>e.type==="lists-progress").length,adsSeen:stats.adsSeen,candidatesAfterFilters:candidates.length}});continue;}
  seen.add(selected.sourceAdId);const scored=await confirmCandidates([selected],targetDef,stats,()=>{});detailsUsed+=stats.detailsChecked;
  const hit=scored.find(x=>x.sourceAdId===selected.sourceAdId);const rej=stats.rejectedSample.find(x=>x.sourceAdId===selected.sourceAdId);const description=hit?.descAuditText??rej?.descAuditText??"";
  listings.push({cell:sc.cell,sourceAdId:selected.sourceAdId,retrievalQuery:sc.query,targetQuery,title:selected.title,descriptionSnapshot:description,descriptionSnapshotAvailable:!!description,descriptionContainsVehiclePartCue:/کاتالیزور|کاتالیز|موتور|گیربکس|سپر|چراغ|آینه|باتری|لاستیک|رینگ|کمک|قطعه|قطعات|اگزوز/.test(normalizeForMatch(description)),eligible:!!hit,matchKind:hit?.matchKind??(rej?"rejected":"unknown"),score:hit?.score??null,evidence:hit?.evidence??[],missingInfo:hit?.missingInfo??[],detailUnknown:hit?.detailUnknown??!description,rejectedKind:rej?.kind??null});
  reports.push({id:sc.id,query:sc.query,status:"captured",cell:sc.cell,retrieval:{maxPages:2,pagesCompleted:events.filter(e=>e.type==="lists-progress").length,adsSeen:stats.adsSeen,candidatesAfterFilters:candidates.length,cursorReturned:endCursor!=null,detailsChecked:stats.detailsChecked}});
 }}finally{if(oldBuffer===undefined)delete process.env.SLUG_CAPTURE_BUFFER_PATH;else process.env.SLUG_CAPTURE_BUFFER_PATH=oldBuffer;if(oldCap===undefined)delete process.env.HUNT_MAX_DETAILS;else process.env.HUNT_MAX_DETAILS=oldCap;}
 const desired=scenarios.map(x=>x.cell);const report={kind:"issue16-retargeted-capture-05D-wrong-item-type",warning:"Target contract is fixed to whole-car buy/sell hunt. Targeted queries only retrieve controls; all candidates are scored against targetQuery. Raw evidence only, not human grades.",createdAt:new Date().toISOString(),branch:process.env.GITHUB_REF_NAME??"local",commit:process.env.GITHUB_SHA??"local",runtime:process.version,targetQuery,requestedCategory:category,limits:{maxPagesPerRetrievalQuery:2,maxDetailsTotal:8,detailsUsed,uniqueListingIds:seen.size,overlapWithPreviouslyInspected:[...overlap],missingCells:desired.filter((c,i)=>desired.slice(0,i+1).filter(x=>x===c).length>listings.filter(x=>x.cell===c).length),mizanShadow:process.env.MIZAN_SHADOW??"default"},targetResolved:{include:targetDef.include,exclude:targetDef.exclude,should:targetDef.should,roleMode:targetDef.roleMode??null,serviceIntent:targetDef.serviceIntent??false,category:targetDef.category},scenarios:reports,listings};
 await writeFile(reportPath,JSON.stringify(report,null,2),"utf8");console.log("ISSUE16_CAPTURE_05D_JSON_BEGIN");console.log(JSON.stringify(report,null,2));console.log("ISSUE16_CAPTURE_05D_JSON_END");
},180_000);
