import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Get session results endpoint not implemented yet",
      },
    },
    { status: 501 }
  );
}
