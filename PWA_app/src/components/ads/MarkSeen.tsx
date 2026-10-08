"use client";

import { useEffect } from "react";
import { markAdSeen } from "@/lib/seen-ads";

/** Records the ad as seen (device-local) so result cards can show "دیده شد". */
export function MarkSeen({ adId }: { adId: string }) {
  useEffect(() => {
    markAdSeen(adId);
  }, [adId]);
  return null;
}
