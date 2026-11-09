import { NextRequest, NextResponse } from "next/server";
import { getVerifiedPaymentUser } from "@/lib/paymentAuth";
import {
  createOrResumeUpiOrder,
  GatewayError,
  listStudentOrders,
} from "@/lib/upiGateway";

export const dynamic = "force-dynamic";

function extractIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

export async function GET(req: NextRequest) {
  try {
    const user = await getVerifiedPaymentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication is required." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const orders = await listStudentOrders(user.uid);
    return NextResponse.json({ orders }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    const status = error instanceof GatewayError ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Unable to fetch orders." },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getVerifiedPaymentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication is required." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const subjectId = typeof body?.subjectId === "string" ? body.subjectId.trim() : "";
    if (!subjectId) {
      return NextResponse.json(
        { error: "Subject selection is required." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const order = await createOrResumeUpiOrder({
      uid: user.uid,
      email: user.email,
      name: user.name || user.email.split("@")[0],
      subjectId,
      ip: extractIp(req),
    });

    return NextResponse.json(
      { order },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    if (error instanceof GatewayError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: { "Cache-Control": "no-store" } }
      );
    }
    console.error("UPI order creation failed:", error);
    return NextResponse.json(
      { error: "Unable to create UPI order right now." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

