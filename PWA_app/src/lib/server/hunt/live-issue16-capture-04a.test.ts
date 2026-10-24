import { it, expect } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizeForMatch } from "@/lib/persianNormalize";
import { resolveHuntDefinition } from "./definition";
import { collectCandidates, confirmCandidates, type HuntEvent } from "./pipeline";
function roleCue(title:string):"mixed"|"buyer"|"seller"|"other"{const t=normalizeForMatch(title);const b=/خریدار|خریدارم|خریداریم|خرید|می\s?خرم|می\s?خوام|می\s?خواهم/.test(t);const s=/فروش|فروشی|فروشنده|به\s?فروش/.test(t);return b&&s?"mixed":b?"buyer":s?"seller":"other";}
type Scenario={id:string;query:string;category:string;cell:string};
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
      "gac3D4fJ",
      "gaU7IS1j",
      "gaWHIDAt",
      "gacvUdQ_",
      "gabT47tX",
      "ga36JfvB",
      "gabnYS2G",
      // IDs from earlier bounded diagnostic captures; exclude across future packets.

]);

function matchesCell(id:string,title:string,description:string):boolean{
 const t=normalizeForMatch(title); const role=roleCue(title);
 if(id.startsWith("A-buyer"))return /یخچال|فریزر|ساید/.test(t)&&role==="buyer";
if(id==="A-mixed")return /یخچال|فریزر|ساید/.test(t)&&role==="mixed";
if(id==="A-seller")return /یخچال|فریزر|ساید/.test(t)&&role==="seller"&&!/تعمیر|خدمات|کارشناسی/.test(t);
if(id==="A-part")return /موتور|کمپرسور|قطعه|قطعات/.test(t)&&/یخچال|فریزر/.test(t);
if(id==="A-service")return /تعمیر|خدمات|سرویس|تعمیرکار/.test(t)&&/یخچال|فریزر/.test(t);
if(id==="A-unrelated")return !/یخچال|فریزر|ساید/.test(t)&&!/تعمیر|خدمات|قطعه|موتور/.test(t)&&role==="buyer";
if(id==="A-ordinary")return /یخچال|فریزر|ساید/.test(t)&&!/تعمیر|خدمات|قطعه|موتور|کمپرسور/.test(t)&&role==="other";
 return false;
}
it.skipIf(process.env.LIVE_DIVAR_OBSERVATION!=="1")("issue16-retargeted-capture-04A-eligibility — bounded read-only capture",async()=>{
 const scenarios:Scenario[]=[
  {
    "id": "A-buyer-1",
    "query": "خریدار یخچال دست دوم",
    "category": "home",
    "cell": "buyer-positive"
  },
  {
    "id": "A-buyer-2",
    "query": "خریدار یخچال",
    "category": "home",
    "cell": "buyer-positive"
  },
  {
    "id": "A-mixed",
    "query": "خرید و فروش یخچال",
    "category": "home",
    "cell": "mixed-positive"
  },
  {
    "id": "A-seller",
    "query": "فروش یخچال دست دوم",
    "category": "home",
    "cell": "seller-positive"
  },
  {
    "id": "A-part",
    "query": "موتور یخچال",
    "category": "home",
    "cell": "part-only-negative"
  },
  {
    "id": "A-service",
    "query": "تعمیر یخچال",
    "category": "home",
    "cell": "service-only-negative"
  },
  {
    "id": "A-unrelated",
    "query": "خریدار لوازم منزل",
    "category": "home",
    "cell": "unrelated-negative"
  },
  {
    "id": "A-ordinary",
    "query": "یخچال دست دوم",
    "category": "home",
    "cell": "ordinary-appliance-positive"
  }
];
 const reportPath=join(process.cwd(),"engine-v3-issue16-capture-04a.json");
 const oldBuffer=process.env.SLUG_CAPTURE_BUFFER_PATH; const oldCap=process.env.HUNT_MAX_DETAILS;
 process.env.SLUG_CAPTURE_BUFFER_PATH=join(process.env.RUNNER_TEMP??process.cwd(),"engine-v3-issue16-capture-04a-slugs.jsonl");
 const seen=new Set<string>();const overlap=new Set<string>();const reports:Array<Record<string,unknown>>=[];let detailsUsed=0;
 try{
  for(const sc of scenarios){
   if(detailsUsed>=8){reports.push({id:sc.id,status:"budget-exhausted",missingCell:sc.cell});continue;}
   const def=resolveHuntDefinition({query:sc.query,include:[],exclude:[],should:[],city:"all",category:sc.category,priceMin:"",priceMax:"",transaction:"",condition:""});
   expect(def,"definition must resolve: "+sc.query).not.toBeNull();if(!def)continue;
   const events:HuntEvent[]=[];const {candidates,stats,endCursor}=await collectCandidates(def,{maxPages:2,emit:e=>events.push(e)});
   const pool=candidates.filter(c=>{if(seen.has(c.sourceAdId))return false;if(previouslyInspectedIds.has(c.sourceAdId)){overlap.add(c.sourceAdId);return false;}return true;});
   const selected=pool.find(c=>matchesCell(sc.id,c.title,""));
   if(!selected){reports.push({id:sc.id,query:sc.query,status:"missing-cell",missingCell:sc.cell,retrieval:{adsSeen:stats.adsSeen,candidatesAfterFilters:candidates.length,maxPages:2}});continue;}
   seen.add(selected.sourceAdId);process.env.HUNT_MAX_DETAILS=String(Math.min(1,8-detailsUsed));
   const scored=await confirmCandidates([selected],def,stats,()=>{});detailsUsed+=stats.detailsChecked;
   const rejected=new Map(stats.rejectedSample.flatMap(x=>x.sourceAdId?[[x.sourceAdId,x] as const]:[]));
   const hit=scored.find(x=>x.sourceAdId===selected.sourceAdId);const rej=rejected.get(selected.sourceAdId);const description=hit?.descAuditText??rej?.descAuditText??"";
   reports.push({id:sc.id,query:sc.query,requestedCategory:sc.category,status:"captured",cell:sc.cell,cellMatchedAfterDetail:matchesCell(sc.id,selected.title,description),listing:{sourceAdId:selected.sourceAdId,title:selected.title,descriptionSnapshot:description,descriptionSnapshotAvailable:!!description,descriptionContainsVehiclePartCue:/کاتالیزور|کاتالیز|موتور|گیربکس|سپر|چراغ|آینه|باتری|لاستیک|رینگ|کمک|جک|قطعه|قطعات|اگزوز/.test(normalizeForMatch(description)),city:selected.city,price:selected.price,roleCue:roleCue(selected.title),roleMode:def.roleMode??null,eligible:!!hit,matchKind:hit?.matchKind??(rej?"rejected":"unknown"),score:hit?.score??null,evidence:hit?.evidence??[],missingInfo:hit?.missingInfo??[],detailUnknown:hit?.detailUnknown??!description,rejectedKind:rej?.kind??null},retrieval:{maxPages:2,pagesCompleted:events.filter(e=>e.type==="lists-progress").length,adsSeen:stats.adsSeen,candidatesAfterFilters:candidates.length,cursorReturned:endCursor!=null,detailsChecked:stats.detailsChecked}});
  }
 }finally{if(oldBuffer===undefined)delete process.env.SLUG_CAPTURE_BUFFER_PATH;else process.env.SLUG_CAPTURE_BUFFER_PATH=oldBuffer;if(oldCap===undefined)delete process.env.HUNT_MAX_DETAILS;else process.env.HUNT_MAX_DETAILS=oldCap;}
 const report={kind:"issue16-retargeted-capture-04A-eligibility",warning:"Raw bounded live evidence only; not human grades and not authorization for code changes.",createdAt:new Date().toISOString(),branch:process.env.GITHUB_REF_NAME??"local",commit:process.env.GITHUB_SHA??"local",runtime:process.version,limits:{maxPagesPerQuery:2,maxDetailsTotal:8,detailsUsed,uniqueListingIds:seen.size,overlapWithPreviouslyInspected:[...overlap],mizanShadow:process.env.MIZAN_SHADOW??"default",scenarios:scenarios.map(x=>({id:x.id,cell:x.cell}))},scenarios:reports};
 await writeFile(reportPath,JSON.stringify(report,null,2),"utf8");console.log("ISSUE16_CAPTURE_04A_JSON_BEGIN");console.log(JSON.stringify(report,null,2));console.log("ISSUE16_CAPTURE_04A_JSON_END");
},180_000);
