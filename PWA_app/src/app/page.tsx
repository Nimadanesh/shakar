import { Suspense } from "react";
import { HuntSetup } from "@/components/search/HuntSetup";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col py-4">
      <Suspense>
        <HuntSetup />
      </Suspense>
    </main>
  );
}
