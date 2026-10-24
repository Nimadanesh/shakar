import { it, expect } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizeForMatch } from "@/lib/persianNormalize";
import { resolveHuntDefinition } from "./definition";
import { collectCandidates, confirmCandidates, type HuntEvent } from "./pipeline";

const previouslyInspectedIds = new Set(["gaPT4jAd","gaVv-2zg","gaODFbLY","gaTnu9bU",
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
function normalizedTitleHead(title:string):string {
 return normalizeForMatch(title).replace(/^(?:(?:مرکز\s+فروش(?:\s+انواع)?|فروش\s+و\s+تعویض|خرید\s+و\s+فروش|فروش|فروشی|معاوضه|خریدار|خرید|فوری|نقدی|قیمت|انواع|مرکز)\s+)+/,"").trim();
}
function isDirectTargetTitle(title:string):boolean { return /کاتالیزور|کاتالیز/.test(normalizeForMatch(title)); }
function isOtherPartTitle(title:string):boolean {
 const t=normalizedTitleHead(title);
 const otherPartHead=/^(?:دیسک(?:\s+ترمز)?|لنت(?:\s+ترمز)?|باتری|گیربکس|رادیاتور|کمک(?:\s+فنر)?|چراغ|سپر|اگزوز|موتور|تسمه(?:\s+تایم)?|دینام|استارت|آینه|لاستیک|رینگ|پلوس|کلاچ|واشر\s+سرسیلندر)(?=\s|$)/.test(t);
 return otherPartHead && !/کاتالیزور|کاتالیز/.test(t);
}
const idsFromRecentCaptures = [
 "gacnoPzO","gazms9IA","gaLn95G9","gag94ErP","gacD4av1","gaM76Zea","QadoH4Gg","ga5ZHsBZ",
 "gacfYpsl","gacn4OE_","gac_3fOf","ga4OPbgu","gaAIGhOy","gaI-nHG5","gaACDACa","gacPG9Wy",
 "gaUTKxZ6","ga5KkOrN","gauW_tpf","gaLrFFB1","gaPvRl88","gaZnu0t_","gaT3FZE5","QZhvyaLi",
 "gaT_9Tmj","gac7VDBQ","QanNEG_8",
 // Source IDs actually opened in Capture 06C run 8; never reuse them.
 "gaNWVCNg","ga0ujTj5","Qa7VnXMI","gac3oiQx","gammdA01","gaNTLxd5",
 // Every detail opened by immutable Capture 06C run #1; never reuse.
 "Qa9ZMSg8","gaZbNGXg","gaPD6_BG","gaQbKcvc",
 // Source IDs actually opened in Capture 06C run 9; never reuse them.
 "Qad2FY4b","gakKPX6R","gaCF0xHF","QaTXVmJj","gaZ_C25X","gaMX7t8J"
];
for (const id of idsFromRecentCaptures) previouslyInspectedIds.add(id);

it.skipIf(process.env.LIVE_DIVAR_OBSERVATION!=="1")("Capture 06C — specific-part body-only false-acceptance candidates",async()=>{
 const targetQuery="کاتالیزور خودرو"; const category="vehicles"; const targetDef=resolve(targetQuery,category);
 expect(targetDef).not.toBeNull(); if(!targetDef)return;
 // Combine the hunted part with a different title-head part so retrieval can surface body-only mentions.
 const retrievalQueries=["کاتالیزور خودرو","کاتالیزور پژو","کاتالیزور سنسور اکسیژن","کاتالیزور منیفولد"];
 const reportPath=join(process.cwd(),"engine-v3-issue16-capture-06c.json");
 const oldBuffer=process.env.SLUG_CAPTURE_BUFFER_PATH; const oldCap=process.env.HUNT_MAX_DETAILS;
 process.env.SLUG_CAPTURE_BUFFER_PATH=join(process.env.RUNNER_TEMP??process.cwd(),"engine-v3-issue16-capture-06c-slugs.jsonl");
 process.env.HUNT_MAX_DETAILS="8";
 const seen=new Set<string>(); const overlap=new Set<string>();
 const pool:Array<{candidate:any;stats:any;query:string}>=[];
 const queryReports:Array<Record<string,unknown>>=[];
 const listings:Array<Record<string,unknown>>=[];
 let detailsUsed=0;
 try {
  for(const query of retrievalQueries) {
   const retrievalDef=resolve(query,category);
   if(!retrievalDef) {queryReports.push({query,status:"unresolved"});continue;}
   const events:HuntEvent[]=[];
   try {
    const {candidates,stats,endCursor}=await collectCandidates(retrievalDef,{maxPages:2,emit:e=>events.push(e)});
    const titleSamples=candidates.slice(0,12).map(c=>({id:c.sourceAdId,title:c.title,normalizedHead:normalizedTitleHead(c.title),otherPartHead:isOtherPartTitle(c.title),previouslyInspected:previouslyInspectedIds.has(c.sourceAdId)}));
    const eligiblePool=candidates.filter(c=>{
     if(previouslyInspectedIds.has(c.sourceAdId)){overlap.add(c.sourceAdId);return false;}
     if(seen.has(c.sourceAdId))return false;
     const directArm=query==="کاتالیزور خودرو"||query==="کاتالیزور پژو";
     return directArm ? isDirectTargetTitle(c.title) : isOtherPartTitle(c.title);
    });
    let added=0;
    // Spend the bounded detail budget on two distinct candidates per retrieval query,
    // rather than one candidate per query; body-only mentions are not visible until detail reads.
    for (const candidate of eligiblePool) {
     if (added>=2 || pool.length>=8) break;
     if (seen.has(candidate.sourceAdId)) continue;
     seen.add(candidate.sourceAdId);
     pool.push({candidate,stats,query});
     added++;
    }
    queryReports.push({query,status:added?"candidates-selected":"no-new-title-heads",pagesCompleted:events.filter(e=>e.type==="lists-progress").length,adsSeen:stats.adsSeen,candidatesAfterFilters:candidates.length,candidatesSelected:added,cursorReturned:endCursor!=null,titleSamples});
   } catch(error) {
    queryReports.push({query,status:"provider-error",error:error instanceof Error?error.message:String(error),pagesCompleted:events.filter(e=>e.type==="lists-progress").length});
   }
   if(pool.length>=8)break;
  }
  for(const entry of pool) {
   if(detailsUsed>=8)break;
   const {candidate,stats,query}=entry;
   const detailsBefore=stats.detailsChecked;
   const scored=await confirmCandidates([candidate],targetDef,stats,()=>{});
   // stats is shared by candidates from the same retrieval query, so count only this call\x27s delta.
   const detailsDelta=stats.detailsChecked-detailsBefore;
   detailsUsed+=detailsDelta;
   if(detailsUsed>8) throw new Error(`Capture 06C exceeded detail budget: ${detailsUsed}/8`);
   const hit=scored.find(x=>x.sourceAdId===candidate.sourceAdId);
   const rej=stats.rejectedSample.find(x=>x.sourceAdId===candidate.sourceAdId);
   const description=hit?.descAuditText??rej?.descAuditText??"";
   const targetInBody=/کاتالیزور|کاتالیز/.test(normalizeForMatch(description));
   const targetInTitle=/کاتالیزور|کاتالیز/.test(normalizeForMatch(candidate.title));
   const candidateArm=(query==="کاتالیزور خودرو"||query==="کاتالیزور پژو")?"direct-title-control":"other-part-title-context";
   listings.push({candidateArm,sourceAdId:candidate.sourceAdId,retrievalQuery:query,targetQuery,title:candidate.title,descriptionSnapshot:description,descriptionSnapshotAvailable:!!description,targetTermInBody:targetInBody,targetTermInTitle:targetInTitle,bodyOnlyCandidate:targetInBody&&!targetInTitle,eligible:!!hit,matchKind:hit?.matchKind??(rej?"rejected":"unknown"),score:hit?.score??null,evidence:hit?.evidence??[],missingInfo:hit?.missingInfo??[],detailUnknown:hit?.detailUnknown??!description,rejectedKind:rej?.kind??null});
  }
 } finally {
  if(oldBuffer===undefined)delete process.env.SLUG_CAPTURE_BUFFER_PATH;else process.env.SLUG_CAPTURE_BUFFER_PATH=oldBuffer;
  if(oldCap===undefined)delete process.env.HUNT_MAX_DETAILS;else process.env.HUNT_MAX_DETAILS=oldCap;
 }
 const report={kind:"issue16-specific-part-body-only-candidate-capture-06C",warning:"Bounded read-only Divar observation with two prespecified arms: direct-title controls and other-part-title context candidates. A title term alone does not prove the target is offered; human grades are authoritative. Engine labels are diagnostic only, not human grades.",createdAt:new Date().toISOString(),branch:process.env.GITHUB_REF_NAME??"local",commit:process.env.GITHUB_SHA??"local",runtime:process.version,targetQuery,requestedCategory:category,limits:{maxPagesPerRetrievalQuery:2,maxDetailsTotal:8,detailsUsed,uniqueListingIds:seen.size,overlapWithPreviouslyInspected:[...overlap],bodyOnlyCandidates:listings.filter(x=>x.bodyOnlyCandidate).length,mizanShadow:process.env.MIZAN_SHADOW??"default"},targetResolved:{include:targetDef.include,exclude:targetDef.exclude,should:targetDef.should,roleMode:targetDef.roleMode??null,serviceIntent:targetDef.serviceIntent??false,category:targetDef.category},queries:queryReports,listings};
 await writeFile(reportPath,JSON.stringify(report,null,2),"utf8");
 console.log("ISSUE16_CAPTURE_06C_JSON_BEGIN");console.log(JSON.stringify(report,null,2));console.log("ISSUE16_CAPTURE_06C_JSON_END");
},180_000);
