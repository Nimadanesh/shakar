import { it, expect } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizeForMatch } from "@/lib/persianNormalize";
import { resolveHuntDefinition } from "./definition";
import { collectCandidates, confirmCandidates, type HuntEvent } from "./pipeline";

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

            // Exclude all selected and previously-inspected IDs from concurrent Capture 04/05B/05C/05D runs.
      "gacnFhbV", "gaxmQ-T0", "gaws10iR", "ga2OVASx", "gaAIGhOy", "QakDQJF0", "gaSn5TN-", "gaUTn_dq", "gaYTx0Nh", "ga4OPbgu", "Qa5v5zFq", "QajXepJL", "gaACDACa", "gavosQ3K", "gacT1wxX", "gazms9IA", "gacL14Hy", "QaW_1rUu", "gaYjd_8x", "gaM76Zea", "QadoH4Gg", "gani4lVK", "gaMTK6Ba", "gaytOWJV", "gacvlkwr", "gacvVagp", "gacvVcvO", "gaWNA_Wu", "gaXXxCBa", "gaY_7zyW", "gacr165A", "gacLEOwU", "gabG8jwy", "gaP3x93H", "ga6V854N", "Qa6rBzmF", "gaXXVQe3", "ganJilnb", "gacrltJ8", "gaZzOFaj", "gaJXNmCp", "QaQXcaE8", "gaEPNrEI", "gacXFoKe", "gacnFrd3", "AaDSxXZ8", "gatgFKnY", "gaTbR5Rb", "gaJaj2PY", "QaorO0r9", "QaYHrsIF", "Qa8HqiWJ", "QaPvpvjd", "gaTTRdcp", "gac7yxi1", "gayVhzOr", "gaKeKHIz", "gaXzUyYo", "ga2qQAPq", "gaHJo2YL", "gaEbOtwX", "gacdDbtu", "QaoPqC7X", "Aa5suyBE", "ga9Nx1wE", "wZcsAVgg", "gaqV1O58", "gaLNJNwu", "gaXy6CJ8", "gaeWepTl", "gaczT30z", "gabzLV7f", "garWfS78", "gaaOqkhk", "gaRDeA35", "ga1M_D8i", "gaVn-dm2", "gaTTl0z-", "gacfUjkL", "gacbUjPx", "gaTI-Kn3", "gac3hpjw", "gaPXd9Pv", "gaYz4Oi-", "gacDldw5", "gacj0uNF", "gac7TJRT", "gaczD8Wv", "gacTj43d", "gac_yx5p", "gaWDC3Xz", "gabDsiQo", "gaDkHop1", "gaDn0jsk", "ga6WBlxy", "gavBLU60", "gaZ6xXmW", "gacLUYlL", "gaDZ88Mm",
  // Reconciled against all artifacts produced by the concurrent runs on commit e8f5fbae.
  "gao5ErU_", "gacj1Pa9", "gaUTKxZ6", "QaEWW4m6", "gaFw50aP", "gaTPiMW9",
  "gacvFnga", "gacjFJlS", "gaN78Ru0", "gaO-ZfFH", "QaXvYWov", "gaI-h9VF",
  "gaYTx0Nh", "gaws10iR", "ga2OVASx", "gaAIGhOy", "gay2Lx5Q", "gaCbVWtl",
  "gaYbXj2I", "gaUTKxZ6", "gaO-ZfFH", "QaEWW4m6", "gaBDmLUN", "gacvV6n1",
  "gaYHpO5O", "gaXdXExC", "Qa6rBzmF", "gaMq1HMq", "gacj1Pa9", "gaFw50aP",
  "gaN78Ru0", "gaGIudV-", "gacXFoKe", "gacblGTq", "gacz0OBI", "ga6KqgSk",
  "gacXV2BZ", "gacfVWSL", "gacrltJ8", "gaIb6BWy", "gatgFKnY", "gaEPNrEI",

  // All five records from the graded fresh subset of Capture 05E.
  "gaT3FZE5", "QZhvyaLi", "gaT_9Tmj", "gac7VDBQ", "QanNEG_8",
]);

function resolve(query:string,category:string){return resolveHuntDefinition({query,include:[],exclude:[],should:[],city:"all",category,priceMin:"",priceMax:"",transaction:"",condition:""});}
function isCell(cell:string,title:string):boolean {
 const t=normalizeForMatch(title);
 const service=/تعمیر|خدمات|تعمیرکار|سرویس|احیا/.test(t);
 const catalyst=/کاتالیزور|کاتالیز/.test(t);
 // Determine the principal item from the title head, not any later make/model
 // mention. This avoids classifying body-parts inventories as whole cars.
 const head=t.replace(/^(?:(?:خرید\s+و\s+فروش|فروش|فروشی|معاوضه|خریدار|خرید|فوری|نقدی)\s+)+/,"");
 const partHead=/^(?:لاستیک|رینگ|سپر|چراغ|آینه|باتری|کاپوت|گلگیر|بدنه|قطعه|قطعات|لوازم یدکی|کاتالیزور|کاتالیز|گیربکس|اگزوز|کمک|موتور خودرو)(?=\s|$)/.test(head);
 const partMention=/موتور|گیربکس|سپر|چراغ|آینه|باتری|لاستیک|رینگ|کمک|قطعه|قطعات|اگزوز|لوازم یدکی|کاپوت|گلگیر|بدنه|کاتالیزور|کاتالیز/.test(t);
 const wholeHead=/^(?:پژو|پراید|سمند|دنا|تیبا|کوییک|ساینا|تارا|شاهین|پارس|رانا|تندر|سورن|۲۰۶|206|۲۰۷|207|۴۰۵|405|ال\s?۹۰|ال\s?90|l90|زانتیا|چری|هایما|فیدلیتی|دیگنیتی|آریزو|اطلس|نیسان|تویوتا|هیوندای|کیا|بنز|مزدا)(?=\s|$)/.test(head)
   || /^فردا موتور\s*fmc511/.test(head);
 const wholeBuyer=/خودرو\s+تصادفی/.test(t)&&/خریدار|خرید|کارشناسی|قیمت گذاری/.test(t);
 const transaction=/فروش|فروشی|معاوضه|خریدار|خرید/.test(t);
 if(cell==="whole-clean") return wholeHead&&!partHead&&!partMention&&!catalyst&&!service&&transaction;
 if(cell==="whole-with-part-mention") return wholeHead&&!partHead&&partMention&&!catalyst&&!service&&transaction;
 if(cell==="whole-buyer") return (wholeHead||wholeBuyer)&&!partHead&&!catalyst&&!service&&/خریدار|خرید|معاوضه/.test(t);
 if(cell==="catalyst-only") return catalyst&&!service;
 if(cell==="catalyst-service") return catalyst&&service;
 if(cell==="other-part") return (partHead||(partMention&&!wholeHead))&&!catalyst&&!service;
 return false;
}
it.skipIf(process.env.LIVE_DIVAR_OBSERVATION!=="1")("Capture 05F — whole-vehicle positives with part mentions vs component/service negatives",async()=>{
 const targetQuery="خرید و فروش خودرو"; const category="vehicles"; const targetDef=resolve(targetQuery,category);
 expect(targetDef).not.toBeNull(); if(!targetDef)return;
 const scenarios=[
  {id:"whole-clean-dena",query:"فروش دنا پلاس",cell:"whole-clean"},
  {id:"whole-with-tire",query:"فروش پراید با لاستیک نو",cell:"whole-with-part-mention"},
  {id:"whole-buyer",query:"خریدار خودرو تصادفی",cell:"whole-buyer"},
  {id:"catalyst-seller",query:"فروش کاتالیزور خودرو",cell:"catalyst-only"},
  {id:"catalyst-buyer",query:"خریدار کاتالیزور فرسوده",cell:"catalyst-only"},
  {id:"catalyst-service",query:"تعمیر کاتالیزور خودرو",cell:"catalyst-service"},
  {id:"bumper-part",query:"فروش سپر پراید",cell:"other-part"},
  {id:"engine-part",query:"فروش موتور خودرو",cell:"other-part"},
 ] as const;
 const reportPath=join(process.cwd(),"engine-v3-issue16-capture-05f.json");
 const oldBuffer=process.env.SLUG_CAPTURE_BUFFER_PATH; const oldCap=process.env.HUNT_MAX_DETAILS;
 process.env.SLUG_CAPTURE_BUFFER_PATH=join(process.env.RUNNER_TEMP??process.cwd(),"engine-v3-issue16-capture-05f-slugs.jsonl"); process.env.HUNT_MAX_DETAILS="8";
 const seen=new Set<string>(); const overlap=new Set<string>(); const listings:Array<Record<string,unknown>>=[]; const reports:Array<Record<string,unknown>>=[]; let detailsUsed=0;
 try {
  for(const sc of scenarios) {
   if(detailsUsed>=8){reports.push({id:sc.id,status:"budget-exhausted",cell:sc.cell});continue;}
   const retrievalDef=resolve(sc.query,category); expect(retrievalDef).not.toBeNull(); if(!retrievalDef)continue;
   const events:HuntEvent[]=[]; const {candidates,stats,endCursor}=await collectCandidates(retrievalDef,{maxPages:2,emit:e=>events.push(e)});
   const pool=candidates.filter(c=>{if(previouslyInspectedIds.has(c.sourceAdId)){overlap.add(c.sourceAdId);return false;}if(seen.has(c.sourceAdId))return false;return true;});
   const selected=pool.find(c=>isCell(sc.cell,c.title));
   if(!selected){reports.push({id:sc.id,query:sc.query,status:"missing-cell",cell:sc.cell,retrieval:{pagesCompleted:events.filter(e=>e.type==="lists-progress").length,adsSeen:stats.adsSeen,candidatesAfterFilters:candidates.length}});continue;}
   seen.add(selected.sourceAdId);
   const scored=await confirmCandidates([selected],targetDef,stats,()=>{}); detailsUsed+=stats.detailsChecked;
   const hit=scored.find(x=>x.sourceAdId===selected.sourceAdId); const rej=stats.rejectedSample.find(x=>x.sourceAdId===selected.sourceAdId); const description=hit?.descAuditText??rej?.descAuditText??"";
   listings.push({cell:sc.cell,sourceAdId:selected.sourceAdId,retrievalQuery:sc.query,targetQuery,title:selected.title,descriptionSnapshot:description,descriptionSnapshotAvailable:!!description,eligible:!!hit,matchKind:hit?.matchKind??(rej?"rejected":"unknown"),score:hit?.score??null,evidence:hit?.evidence??[],missingInfo:hit?.missingInfo??[],detailUnknown:hit?.detailUnknown??!description,rejectedKind:rej?.kind??null});
   reports.push({id:sc.id,query:sc.query,status:"captured",cell:sc.cell,retrieval:{maxPages:2,pagesCompleted:events.filter(e=>e.type==="lists-progress").length,adsSeen:stats.adsSeen,candidatesAfterFilters:candidates.length,cursorReturned:endCursor!=null,detailsChecked:stats.detailsChecked}});
  }
 } finally {if(oldBuffer===undefined)delete process.env.SLUG_CAPTURE_BUFFER_PATH;else process.env.SLUG_CAPTURE_BUFFER_PATH=oldBuffer;if(oldCap===undefined)delete process.env.HUNT_MAX_DETAILS;else process.env.HUNT_MAX_DETAILS=oldCap;}
 const report={kind:"issue16-capture-05f-whole-vehicle-part-mention-countercontrols",warning:"Fixed broad whole-car target; targeted queries retrieve controls only. Raw evidence, not human grades.",createdAt:new Date().toISOString(),branch:process.env.GITHUB_REF_NAME??"local",commit:process.env.GITHUB_SHA??"local",runtime:process.version,targetQuery,requestedCategory:category,limits:{maxPagesPerRetrievalQuery:2,maxDetailsTotal:8,detailsUsed,uniqueListingIds:seen.size,overlapWithPreviouslyInspected:[...overlap],mizanShadow:process.env.MIZAN_SHADOW??"default"},scenarios:reports,listings};
 await writeFile(reportPath,JSON.stringify(report,null,2),"utf8"); console.log("ISSUE16_CAPTURE_05F_JSON_BEGIN"); console.log(JSON.stringify(report,null,2)); console.log("ISSUE16_CAPTURE_05F_JSON_END");
},180_000);
