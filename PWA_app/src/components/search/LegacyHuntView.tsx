"use client";

import { useRouter } from "next/navigation";
import { History } from "lucide-react";
import type { HuntRecord } from "@/lib/hunt-store";
import { huntSpecSummary } from "@/lib/hunt-summary";
import { writeParams } from "@/lib/search-params";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Legacy hunt record (pre-runId): the results were never persisted to a
 * server run, so there is nothing honest to replay. Show the exact hunt
 * definition and offer one explicit action — re-fire it as a real hunt.
 * No fixture data, no invented results.
 */
export function LegacyHuntView({ hunt }: { hunt: HuntRecord }) {
  const router = useRouter();

  function handleRerun() {
    router.push(`/${writeParams(hunt.query, hunt.base)}&setup=1`);
  }

  return (
    <div className="flex flex-col gap-4">
      <EmptyState
        icon={<History size={28} aria-hidden="true" className="text-muted-foreground" />}
        title="این شکار قدیمیه"
        description={`«${hunt.query}» — ${huntSpecSummary(hunt)}`}
        primaryAction={{ label: "دوباره شکار کن", onClick: handleRerun }}
        secondaryAction={{ label: "بازگشت به خانه", onClick: () => router.push("/") }}
      />
      <p className="text-center text-[12px] leading-5 text-muted-foreground">
        نتیجه‌های شکارهای قدیمی ذخیره نمی‌شدن؛ با «دوباره شکار کن» یه شکار واقعی و تازه می‌گیری.
      </p>
    </div>
  );
}
