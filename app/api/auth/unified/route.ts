import { NextRequest, NextResponse } from "next/server";
import { logLoginActivity, recordUser, getUserByEmail, getUserById } from "@/lib/db";
import { 
  SESSION_COOKIE_NAME, 
  isAdminEmail,
  isValidAdminPassword,
  createSignedAdminToken,
  extractBearerToken,
  verifyFirebaseIdToken
} from "@/lib/adminAuth";

function issueAdminResponse(
  req: NextRequest,
  adminUser: { uid: string; email: string; displayName: string; rollNumber: string }
) {
  const sessionData = {
    email: adminUser.email,
    role: "admin" as const,
    exp: Date.now() + 7 * 24 * 3600 * 1000,
  };
  const token = createSignedAdminToken(sessionData);

  const response = NextResponse.json({
    success: true,
    role: "admin",
    redirectTo: "/admin",
    token,
    user: {
      uid: adminUser.uid,
      email: adminUser.email,
      displayName: adminUser.displayName,
      role: "admin",
      rollNumber: adminUser.rollNumber,
    },
  });

  const host = req.headers.get("host") || "";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const isSecure = process.env.NODE_ENV === "production" && !isLocalhost;

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 7 * 24 * 3600,
    path: "/",
  });

  return response;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, name, isSessionRestore } = body;

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const trimmedPass = String(password || "").trim();
    const trimmedName = String(name || "").trim();
    const bearerToken = extractBearerToken(req);

    const ip = req.headers.get("x-forwarded-for") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    // 1. Primary Path: Cryptographically verified Firebase ID Token in Authorization Bearer header
    if (bearerToken) {
      const fbUser = await verifyFirebaseIdToken(bearerToken);
      if (!fbUser || !fbUser.email || !fbUser.uid) {
        return NextResponse.json(
          { error: "Invalid, expired, or unverified authentication token. Please sign in again." },
          { status: 401 }
        );
      }

      const verifiedEmail = fbUser.email.trim().toLowerCase();
      const verifiedUid = fbUser.uid;
      const authProvider = fbUser.provider || "password";

      if (normalizedEmail && normalizedEmail !== verifiedEmail) {
        return NextResponse.json(
          { error: "Authenticated token email does not match the submitted email address." },
          { status: 401 }
        );
      }

      if (isAdminEmail(verifiedEmail)) {
        if (!isSessionRestore) {
          await logLoginActivity({
            email: verifiedEmail,
            role: "admin",
            status: "success",
            authProvider,
            ip,
            userAgent,
          });
        }

        const existingAdmin =
          (await getUserById(verifiedUid, bearerToken)) ||
          (await getUserByEmail(verifiedEmail, bearerToken));
        const effectiveDisplayName =
          trimmedName ||
          fbUser.name ||
          existingAdmin?.displayName ||
          verifiedEmail.split("@")[0].toUpperCase();
        const effectiveRollNumber = existingAdmin?.rollNumber || "OS-ADMIN";

        await recordUser(
          {
            uid: verifiedUid,
            email: verifiedEmail,
            displayName: effectiveDisplayName,
            role: "admin",
            rollNumber: effectiveRollNumber,
            authProvider,
          },
          bearerToken
        );

        return issueAdminResponse(req, {
          uid: verifiedUid,
          email: verifiedEmail,
          displayName: effectiveDisplayName,
          rollNumber: effectiveRollNumber,
        });
      }

      // Verified Student / Regular User
      const existingUser =
        (await getUserById(verifiedUid, bearerToken)) ||
        (await getUserByEmail(verifiedEmail, bearerToken));
      const displayName =
        trimmedName ||
        fbUser.name ||
        existingUser?.displayName ||
        verifiedEmail.split("@")[0];

      if (!isSessionRestore) {
        await logLoginActivity({
          email: verifiedEmail,
          role: "user",
          status: "success",
          authProvider,
          ip,
          userAgent,
        });
      }

      const recordedUser = await recordUser(
        {
          uid: verifiedUid,
          email: verifiedEmail,
          displayName,
          role: "user",
          rollNumber: existingUser?.rollNumber || `OS-USR-${Math.floor(1000 + Math.random() * 9000)}`,
          authProvider,
        },
        bearerToken
      );

      return NextResponse.json({
        success: true,
        role: "user",
        redirectTo: "/dashboard",
        user: {
          uid: recordedUser.uid,
          email: recordedUser.email,
          displayName: recordedUser.displayName,
          role: "user",
          rollNumber: recordedUser.rollNumber,
        },
      });
    }

    // 2. Secondary Path: Dedicated Admin Passkey Authentication (strictly for whitelisted admin emails)
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
    }

    if (isAdminEmail(normalizedEmail)) {
      if (!trimmedPass || !isValidAdminPassword(trimmedPass)) {
        await logLoginActivity({
          email: normalizedEmail,
          role: "admin",
          status: "failed",
          authProvider: "password",
          ip,
          userAgent,
        });

        return NextResponse.json(
          { error: "Invalid admin password." },
          { status: 401 }
        );
      }

      await logLoginActivity({
        email: normalizedEmail,
        role: "admin",
        status: "success",
        authProvider: "password",
        ip,
        userAgent,
      });

      const existingAdmin = await getUserByEmail(normalizedEmail);
      const effectiveUid = existingAdmin?.uid || "admin-" + Buffer.from(normalizedEmail).toString("hex").slice(0, 8);
      const effectiveDisplayName = trimmedName || existingAdmin?.displayName || normalizedEmail.split("@")[0].toUpperCase();
      const effectiveRollNumber = existingAdmin?.rollNumber || "OS-ADMIN";

      await recordUser({
        uid: effectiveUid,
        email: normalizedEmail,
        displayName: effectiveDisplayName,
        role: "admin",
        rollNumber: effectiveRollNumber,
        authProvider: "password",
      });

      return issueAdminResponse(req, {
        uid: effectiveUid,
        email: normalizedEmail,
        displayName: effectiveDisplayName,
        rollNumber: effectiveRollNumber,
      });
    }

    // 3. Reject any unverified student login attempt without a valid Firebase Bearer token
    return NextResponse.json(
      { error: "Authentication requires a verified Firebase ID token. Please sign in with your email and password." },
      { status: 401 }
    );
  } catch (err: any) {
    console.error("Unified auth error:", err);
    const status = err?.code === "FIRESTORE_DISABLED" ? 503 : 500;
    return NextResponse.json(
      { 
        error: err?.message || "Authentication system encountered an issue. Please try again.",
        code: err?.code || "AUTH_ERROR",
        activationUrl: err?.activationUrl,
      },
      { status }
    );
  }
}
