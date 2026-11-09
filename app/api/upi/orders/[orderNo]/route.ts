import { NextRequest, NextResponse } from "next/server";
import { getVerifiedPaymentUser } from "@/lib/paymentAuth";
import { getPaymentEntitlement, isEntitlementActive } from "@/lib/purchases";
import { GatewayError, getStudentOrder } from "@/lib/upiGateway";

export const dynamic = "force-dynamic";

export async function GET(
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

    const order = await getStudentOrder(params.orderNo, user.uid);
    if (!order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const entitlement = await getPaymentEntitlement(user.uid, order.subjectId);
    const entitlementActive = isEntitlementActive(entitlement);

    return NextResponse.json(
      {
        order,
        entitlement: entitlement
          ? {
              subjectId: entitlement.subjectId,
              active: entitlementActive,
              expired: !entitlementActive,
              purchasedAt: entitlement.purchasedAt,
              expiresAt: entitlement.expiresAt,
            }
          : null,
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
    return NextResponse.json(
      { error: "Unable to check order status." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

