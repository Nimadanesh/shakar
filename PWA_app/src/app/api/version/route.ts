import { NextResponse } from "next/server";

/**
 * Public, read-only build identity for verifying the exact version served by
 * a deployed environment. Intentionally exposes only public commit metadata.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const commitSha =
    process.env.RAILWAY_GIT_COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    null;
  const branch =
    process.env.RAILWAY_GIT_BRANCH ??
    process.env.VERCEL_GIT_COMMIT_REF ??
    null;

  return NextResponse.json(
    {
      ok: true,
      service: "shakar",
      commitSha,
      branch,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
