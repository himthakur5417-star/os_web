import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { GatewayError, getAdminUpiOverview } from "@/lib/upiGateway";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authCheck = await verifyAdminRequest(req);
  if (!authCheck.authorized || !authCheck.email) {
    return NextResponse.json(
      { error: "Unauthorized access" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const overview = await getAdminUpiOverview();
    return NextResponse.json(overview, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: any) {
    const status = error instanceof GatewayError ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Failed to load UPI Gateway overview." },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

