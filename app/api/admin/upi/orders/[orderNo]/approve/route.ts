import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { approveOrderUtr, GatewayError } from "@/lib/upiGateway";

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
    const rawBankUtr = typeof body?.bankUtr === "string" ? body.bankUtr : "";
    const order = await approveOrderUtr({
      orderNo: params.orderNo,
      adminEmail: authCheck.email,
      rawBankUtr,
      ip: extractIp(req),
    });

    return NextResponse.json({
      success: true,
      message: `UTR ${order.utr} matched & approved. 365-day subject access unlocked.`,
      order,
    });
  } catch (error: any) {
    if (error instanceof GatewayError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error?.message || "Failed to approve order." }, { status: 500 });
  }
}

