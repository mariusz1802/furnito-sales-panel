import { NextResponse } from "next/server";
import { syncAllegroOrders } from "@/lib/integrations/allegro";

export async function GET() {
  const result = await syncAllegroOrders();
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
