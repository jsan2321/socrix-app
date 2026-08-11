import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Document status endpoint not implemented yet",
      },
    },
    { status: 501 }
  );
}
