import { NextRequest, NextResponse } from "next/server";
import { validateUrl } from "@/lib/argus/url-validator";
import { runExploration } from "@/lib/argus/exploration-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: "URL is required" },
        { status: 400 }
      );
    }

    const validation = validateUrl(url);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { session, result } = await runExploration(url, {
      maxPages: 20,
      timeout: 30000,
    });

    return NextResponse.json({
      success: true,
      session,
      result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
