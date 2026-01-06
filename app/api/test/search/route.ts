import { NextRequest, NextResponse } from "next/server";
import { searchRecords } from "@/src/workflows/attio.actions";

/**
 * Test endpoint for Attio search functionality.
 *
 * GET /api/test/search?object=companies&query=Acme
 * POST /api/test/search { object: "companies", query: "Acme" }
 */
export async function GET(request: NextRequest): Promise<Response> {
  const searchParams = request.nextUrl.searchParams;
  const object = searchParams.get("object") || "companies";
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ error: "Missing required parameter: query" }, { status: 400 });
  }

  try {
    const results = await searchRecords(object, query);
    return NextResponse.json({
      query,
      object,
      resultCount: results.length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const { object = "companies", query } = body;

    if (!query) {
      return NextResponse.json({ error: "Missing required field: query" }, { status: 400 });
    }

    const results = await searchRecords(object, query);
    return NextResponse.json({
      query,
      object,
      resultCount: results.length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
