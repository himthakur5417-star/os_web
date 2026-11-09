import { NextRequest } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/adminAuth";

export interface VerifiedPaymentUser {
  uid: string;
  email: string;
  provider?: string;
  name?: string;
}

export async function getVerifiedPaymentUser(req: NextRequest): Promise<VerifiedPaymentUser | null> {
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;

  const verified = await verifyFirebaseIdToken(token);
  if (!verified?.uid || !verified.email) return null;

  return {
    uid: verified.uid,
    email: verified.email,
    provider: verified.provider,
    name: verified.name,
  };
}

export function getBearerToken(req: NextRequest): string | null {
  const authorization = req.headers.get("authorization") || "";
  return authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}
