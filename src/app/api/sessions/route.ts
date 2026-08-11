import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Create session endpoint not implemented yet",
      },
    },
    { status: 501 }
  );
}
