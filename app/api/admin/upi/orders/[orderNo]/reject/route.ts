import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { GatewayError, rejectOrderUtr } from "@/lib/upiGateway";

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
    const reason = typeof body?.reason === "string" ? body.reason : undefined;
    const order = await rejectOrderUtr({
      orderNo: params.orderNo,
      adminEmail: authCheck.email,
      reason,
      ip: extractIp(req),
    });

    return NextResponse.json({
      success: true,
      message:
        order.status === "pending"
          ? "UTR rejected. The student can verify and resubmit."
          : "UTR rejected. Maximum attempts reached; order expired.",
      order,
    });
  } catch (error: any) {
    if (error instanceof GatewayError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error?.message || "Failed to reject UTR." }, { status: 500 });
  }
}

