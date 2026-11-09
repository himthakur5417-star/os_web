import { NextRequest, NextResponse } from "next/server";
import { getVerifiedPaymentUser } from "@/lib/paymentAuth";
import { GatewayError, submitCustomerUtr } from "@/lib/upiGateway";

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
  try {
    const user = await getVerifiedPaymentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication is required." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawUtr = typeof body?.utr === "string" ? body.utr : "";

    const order = await submitCustomerUtr({
      orderNo: params.orderNo,
      uid: user.uid,
      email: user.email,
      rawUtr,
      ip: extractIp(req),
    });

    return NextResponse.json(
      {
        success: true,
        order,
        message: "UTR submitted. Waiting for admin verification.",
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    if (error instanceof GatewayError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: { "Cache-Control": "no-store" } }
      );
    }
    console.error("Failed to submit customer UTR:", error);
    return NextResponse.json(
      { error: "Unable to submit UTR right now. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

