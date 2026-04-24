import { supabase } from "@/lib/db";
import { NextResponse } from "next/server";

export const revalidate = 300; // cache for 5 minutes

export async function GET() {
  const { count, error } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  if (error) {
    return NextResponse.json({ count: null }, { status: 500 });
  }

  return NextResponse.json({ count });
}
