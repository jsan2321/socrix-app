import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
function safeNext(value: string | null) { return value?.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/dashboard"; }
export async function GET(request: NextRequest) {
  const url = new URL(request.url); const code = url.searchParams.get("code"); const response = NextResponse.redirect(new URL(safeNext(url.searchParams.get("next")), url.origin)); const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON;
  if (!code || !supabaseUrl || !supabaseKey) return NextResponse.redirect(new URL("/auth/login?error=callback", url.origin));
  const supabase = createServerClient(supabaseUrl, supabaseKey, { cookies: { getAll: () => request.cookies.getAll(), setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error ? NextResponse.redirect(new URL("/auth/login?error=callback", url.origin)) : response;
}
