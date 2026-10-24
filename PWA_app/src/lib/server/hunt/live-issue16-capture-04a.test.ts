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
      "gac3D4fJ",
      "gaU7IS1j",
      "gaWHIDAt",
      "gacvUdQ_",
      "gabT47tX",
      "ga36JfvB",
      "gabnYS2G",
      // Exclude every listing opened in the first, invalid-context Capture 04 attempt.
      "gaEbOtwX", "gaXy6CJ8", "gaRDeA35", "gacDldw5", "gaDn0jsk", "ga6WBlxy", "gaDZ88Mm", "gaaHGbGp",
      "gaTzFnuN", "gacHlCAO", "gaU33g50", "QaorO0r9", "gaa9oSP6", "ga-x6Euu", "gaTTRdcp", "gaXzUyYo",
      // IDs from earlier bounded diagnostic captures; exclude across future packets.

]);

function cellsFor(title:string):string[]{const t=normalizeForMatch(title);const role=roleCue(title);const appliance=/یخچال|فریزر|ساید/.test(t);const part=/موتور|کمپرسور|قطعه|قطعات/.test(t);const service=/تعمیر|خدمات|سرویس|تعمیرکار/.test(t);
 const cells:string[]=[];
 if(appliance&&!part&&!service&&role==="buyer")cells.push("buyer-positive");
 if(appliance&&!part&&!service&&role==="mixed")cells.push("mixed-positive");
 if(appliance&&!part&&!service&&role==="seller")cells.push("seller-positive");
 if(appliance&&!part&&!service&&role==="other")cells.push("ordinary-appliance-positive");
 if(appliance&&part&&!service)cells.push("part-only-negative");
 if(appliance&&service)cells.push("service-only-negative");
 if(!appliance&&!part&&!service)cells.push("unrelated-negative");
 return cells;}
it.skipIf(process.env.LIVE_DIVAR_OBSERVATION!=="1")("Capture 04A — appliance eligibility in one fixed broad hunt",async()=>{
 const query="خرید و فروش یخچال";const category="home";const reportPath=join(process.cwd(),"engine-v3-issue16-capture-04a.json");
 const oldBuffer=process.env.SLUG_CAPTURE_BUFFER_PATH;const oldCap=process.env.HUNT_MAX_DETAILS;process.env.SLUG_CAPTURE_BUFFER_PATH=join(process.env.RUNNER_TEMP??process.cwd(),"engine-v3-issue16-capture-04a-slugs.jsonl");process.env.HUNT_MAX_DETAILS="8";
 try{
  const def=resolveHuntDefinition({query,include:[],exclude:[],should:[],city:"all",category,priceMin:"",priceMax:"",transaction:"",condition:""});expect(def).not.toBeNull();if(!def)return;
  const events:HuntEvent[]=[];const {candidates,stats,endCursor}=await collectCandidates(def,{maxPages:2,emit:e=>events.push(e)});
  const overlap=new Set<string>();const pool=candidates.filter(c=>{if(previouslyInspectedIds.has(c.sourceAdId)){overlap.add(c.sourceAdId);return false;}return true;});
  const desired=["buyer-positive","buyer-positive","mixed-positive","seller-positive","ordinary-appliance-positive","part-only-negative","service-only-negative","unrelated-negative"];
  const selected:typeof candidates=[];const labels:string[]=[];
  for(const cell of desired){const match=pool.find(c=>!selected.some(x=>x.sourceAdId===c.sourceAdId)&&cellsFor(c.title).includes(cell));if(match){selected.push(match);labels.push(cell);}}
  const scored=await confirmCandidates(selected,def,stats,()=>{});
  const rejected=new Map(stats.rejectedSample.flatMap(x=>x.sourceAdId?[[x.sourceAdId,x] as const]:[]));const scoredMap=new Map(scored.map(x=>[x.sourceAdId,x] as const));
  const listings=selected.map((c,i)=>{const hit=scoredMap.get(c.sourceAdId);const rej=rejected.get(c.sourceAdId);const description=hit?.descAuditText??rej?.descAuditText??"";return {cell:labels[i],sourceAdId:c.sourceAdId,title:c.title,descriptionSnapshot:description,descriptionSnapshotAvailable:!!description,roleCue:roleCue(c.title),eligible:!!hit,matchKind:hit?.matchKind??(rej?"rejected":"unknown"),score:hit?.score??null,evidence:hit?.evidence??[],missingInfo:hit?.missingInfo??[],detailUnknown:hit?.detailUnknown??!description,rejectedKind:rej?.kind??null};});
  const report={kind:"issue16-retargeted-capture-04A-eligibility",warning:"Single fixed broad hunt; raw live diagnostics only, not human grades. Missing cells are not substituted.",createdAt:new Date().toISOString(),branch:process.env.GITHUB_REF_NAME??"local",commit:process.env.GITHUB_SHA??"local",runtime:process.version,query,requestedCategory:category,limits:{maxPagesPerQuery:2,maxDetailsTotal:8,detailsChecked:stats.detailsChecked,uniqueListingIds:selected.length,overlapWithPreviouslyInspected:[...overlap],missingCells:desired.filter((c,i)=>!labels[i]&&desired.slice(0,i+1).filter(x=>x===c).length>labels.filter(x=>x===c).length),mizanShadow:process.env.MIZAN_SHADOW??"default"},resolved:{include:def.include,exclude:def.exclude,should:def.should,roleMode:def.roleMode??null,serviceIntent:def.serviceIntent??false,category:def.category},retrieval:{pagesCompleted:events.filter(e=>e.type==="lists-progress").length,adsSeen:stats.adsSeen,candidatesAfterFilters:candidates.length,cursorReturned:endCursor!=null},listings};
  await writeFile(reportPath,JSON.stringify(report,null,2),"utf8");console.log("ISSUE16_CAPTURE_04A_JSON_BEGIN");console.log(JSON.stringify(report,null,2));console.log("ISSUE16_CAPTURE_04A_JSON_END");
 }finally{if(oldBuffer===undefined)delete process.env.SLUG_CAPTURE_BUFFER_PATH;else process.env.SLUG_CAPTURE_BUFFER_PATH=oldBuffer;if(oldCap===undefined)delete process.env.HUNT_MAX_DETAILS;else process.env.HUNT_MAX_DETAILS=oldCap;}
},180_000);
