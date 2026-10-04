import { Suspense } from "react";
import { SearchWorkspace } from "@/components/search/SearchWorkspace";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col py-4">
      <Suspense>
        <SearchWorkspace />
      </Suspense>
    </main>
  );
}
