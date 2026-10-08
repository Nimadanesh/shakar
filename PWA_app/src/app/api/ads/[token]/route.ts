import { NextResponse } from "next/server";
import { divarProvider } from "@/lib/server/divar/divarClient";

/**
 * GET /api/ads/[token] — one real ad's detail, fetched live from Divar
 * (60-min server cache). Public listing data; no auth needed.
 * 404 when the ad can't be fetched (deleted, network, upstream down) —
 * the caller shows an honest "جزئیات در دسترس نیست", never invented data.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (typeof token !== "string" || token.trim() === "") {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "آگهی پیدا نشد." } },
      { status: 404 }
    );
  }
  try {
    const detail = await divarProvider.getDetail(token.trim());
    return NextResponse.json({ ok: true, data: detail });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UNAVAILABLE",
          message: "جزئیات آگهی در دسترس نیست.",
        },
      },
      { status: 502 }
    );
  }
}
