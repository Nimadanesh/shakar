import { Suspense } from "react";
import { HuntSetup } from "@/components/search/HuntSetup";
import { HomeCityPrompt } from "@/components/search/HomeCityPrompt";
import { NewsFab } from "@/components/market/NewsFab";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col py-4">
      <Suspense>
        <HuntSetup />
      </Suspense>
      <HomeCityPrompt />
      <NewsFab />
    </main>
  );
}
