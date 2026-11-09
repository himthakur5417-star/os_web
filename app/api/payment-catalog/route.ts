import { NextResponse } from "next/server";
import { getPublicSubjectCatalog } from "@/lib/paymentCatalog";
import { isPaymentPersistenceConfigured } from "@/lib/purchases";
import { isUpiGatewayConfigured } from "@/lib/upiGateway";

export const dynamic = "force-dynamic";

export async function GET() {
  const gatewayConfigured = await isUpiGatewayConfigured();
  return NextResponse.json(
    {
      gateway: "upi",
      subjects: getPublicSubjectCatalog(),
      checkoutReady: Boolean(gatewayConfigured && isPaymentPersistenceConfigured()),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
