import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { GatewayError, markOrderPaidManually } from "@/lib/upiGateway";

export const dynamic = "force-dynamic";

function extractIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: { orderNo: string } }
) {
  const authCheck = await verifyAdminRequest(req);
  if (!authCheck.authorized || !authCheck.email) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawUtr = typeof body?.utr === "string" ? body.utr : "";
    const order = await markOrderPaidManually({
      orderNo: params.orderNo,
      adminEmail: authCheck.email,
      rawUtr,
      ip: extractIp(req),
    });

    return NextResponse.json({
      success: true,
      message: `Order confirmed with UTR ${order.utr}. 365-day subject access unlocked.`,
      order,
    });
  } catch (error: any) {
    if (error instanceof GatewayError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error?.message || "Failed to mark order paid." }, { status: 500 });
  }
}

