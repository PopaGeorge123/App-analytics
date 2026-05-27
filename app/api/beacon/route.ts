import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // Accept a small JSON payload and respond with 204 No Content.
    // This route exists so client-side analytics can send a same-origin beacon
    // without attempting to read a cross-origin response (avoids CORB).
    await req.json().catch(() => null);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return new NextResponse(null, { status: 500 });
  }
}

export async function GET() {
  // Keep GET idempotent and return 204 as well.
  return new NextResponse(null, { status: 204 });
}
