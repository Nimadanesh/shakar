"use client";

import { useEffect, useState } from "react";
import { ChartLine, ExternalLink } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/LoadingState";
import { PriceToman } from "@/components/ui/PriceToman";
import { Sparkline } from "@/components/market/Sparkline";
import type { MarketNewsItem, MarketPrice } from "@/lib/market";
import { cn } from "@/lib/utils";

type TabId = "prices" | "news" | "advisor";

const TABS = [
  { id: "prices", label: "قیمت ارز و سکه" },
  { id: "news", label: "اخبار اقتصادی" },
  { id: "advisor", label: "مشاور اقتصادی" },
] as const;

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span
      className={cn(
        "text-[12px] font-medium tabular-nums",
        up ? "text-success" : "text-danger"
      )}
    >
      {up ? "▲" : "▼"} {Math.abs(pct).toLocaleString("fa-IR", { maximumFractionDigits: 2 })}٪
    </span>
  );
}

function PricesTab() {
  const [items, setItems] = useState<MarketPrice[] | null>(null);
  const [updated, setUpdated] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setItems(null);
    fetch("/api/market/prices")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        if (d?.ok && Array.isArray(d.data)) {
          setItems(d.data);
          const first = d.data.find(
            (p: MarketPrice) => typeof p.updatedJalali === "string"
          );
          setUpdated(first?.updatedJalali ?? null);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [retry]);

  if (failed) {
    return (
      <EmptyState
        title="قیمت‌ها در دسترس نیست"
        description="اتصال به منبع قیمت برقرار نشد؛ کمی بعد دوباره تلاش کن."
        primaryAction={{ label: "تلاش دوباره", onClick: () => setRetry((r) => r + 1) }}
      />
    );
  }

  if (items === null) {
    return (
      <div className="flex justify-center py-10">
        <LoadingState label="در حال دریافت قیمت‌ها…" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <ul className="flex flex-col divide-y divide-border">
        {items.map((p) => (
          <li key={p.symbol} className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-[14px] font-medium text-foreground">
                {p.name}
              </span>
              <ChangeBadge pct={p.changePct} />
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Sparkline points={p.spark} />
              <PriceToman
                value={p.price}
                className="min-w-24 text-left text-[15px] font-semibold tabular-nums text-foreground"
              />
            </div>
          </li>
        ))}
      </ul>
      {updated && (
        <p className="pt-2 text-[11px] leading-5 text-muted-foreground">
          آخرین به‌روزرسانی: <span className="tabular-nums">{updated}</span>
        </p>
      )}
    </div>
  );
}

function NewsTab() {
  const [items, setItems] = useState<MarketNewsItem[] | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/market/news")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        if (d?.ok && Array.isArray(d.data)) {
          setItems(d.data);
          setSource(typeof d.source === "string" ? d.source : null);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (failed) {
    return (
      <EmptyState
        title="اخبار در دسترس نیست"
        description="دریافت خبرها ممکن نشد؛ کمی بعد دوباره تلاش کن."
      />
    );
  }

  if (items === null) {
    return (
      <div className="flex justify-center py-10">
        <LoadingState label="در حال دریافت خبرها…" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="خبری نیست"
        description="در حال حاضر خبر اقتصادی تازه‌ای پیدا نشد."
      />
    );
  }

  return (
    <div className="flex flex-col">
      <ul className="flex flex-col divide-y divide-border">
        {items.map((n) => (
          <li key={n.link}>
            <a
              href={n.link}
              target="_blank"
              rel="noreferrer"
              className="flex items-start justify-between gap-3 py-3 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="text-[14px] leading-6 text-foreground">
                {n.title}
              </span>
              <ExternalLink
                size={15}
                aria-hidden="true"
                className="mt-1 shrink-0 text-muted-foreground"
              />
            </a>
          </li>
        ))}
      </ul>
      {source && (
        <p className="pt-2 text-[11px] leading-5 text-muted-foreground">
          منبع: {source}
        </p>
      )}
    </div>
  );
}

function AdvisorTab() {
  return (
    <EmptyState
      icon={<ChartLine size={28} aria-hidden="true" className="text-muted-foreground" />}
      title="مشاور اقتصادی"
      description="به‌زودی: تحلیل روند بازار و پیشنهاد زمان خرید، مخصوص شکارچی‌های حرفه‌ای."
    />
  );
}

export function MarketSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabId>("prices");

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="اخبار و قیمت بازار"
      title="بازار"
      subtitle="قیمت لحظه‌ای و خبرهای مهم اقتصادی"
      dialogClassName="min-h-[60dvh]"
    >
      <SegmentedTabs
        tabs={TABS.map((t) => ({ ...t }))}
        active={tab}
        onChange={(id) => setTab(id as TabId)}
        ariaLabel="بخش‌های بازار"
      />
      {tab === "prices" && <PricesTab />}
      {tab === "news" && <NewsTab />}
      {tab === "advisor" && <AdvisorTab />}
    </BottomSheet>
  );
}
