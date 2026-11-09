import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { deleteUpiAccount, GatewayError, listUpiAccounts, saveUpiAccount } from "@/lib/upiGateway";

export const dynamic = "force-dynamic";

function extractIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

export async function GET(req: NextRequest) {
  const authCheck = await verifyAdminRequest(req);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  const accounts = await listUpiAccounts();
  return NextResponse.json({ accounts }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const authCheck = await verifyAdminRequest(req);
  if (!authCheck.authorized || !authCheck.email) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const account = await saveUpiAccount(
      {
        id: typeof body?.id === "string" ? body.id : undefined,
        label: typeof body?.label === "string" ? body.label : "Merchant UPI",
        upiId: typeof body?.upiId === "string" ? body.upiId : "",
        payeeName: typeof body?.payeeName === "string" ? body.payeeName : "Officium Supremum",
        dailyLimitRupees: Number(body?.dailyLimitRupees || 0),
        isActive: body?.isActive !== undefined ? Boolean(body.isActive) : true,
      },
      authCheck.email,
      extractIp(req)
    );

    return NextResponse.json({ success: true, account }, { status: 200 });
  } catch (error: any) {
    if (error instanceof GatewayError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error?.message || "Failed to save UPI account." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authCheck = await verifyAdminRequest(req);
  if (!authCheck.authorized || !authCheck.email) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "";
    if (!id) {
      return NextResponse.json({ error: "Account ID is required." }, { status: 400 });
    }
    await deleteUpiAccount(id, authCheck.email, extractIp(req));
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    if (error instanceof GatewayError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error?.message || "Failed to delete UPI account." }, { status: 500 });
  }
}

