import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Submit answer endpoint not implemented yet",
      },
    },
    { status: 501 }
  );
}
