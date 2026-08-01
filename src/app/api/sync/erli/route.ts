import { NextResponse } from "next/server";
import { syncErliOrders } from "@/lib/integrations/erli";

export async function GET() {
  const result = await syncErliOrders();
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
