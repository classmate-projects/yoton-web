import { apiFetch } from "@/lib/api";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;

    // Best-effort: revoking the refresh token server-side is what actually kills the
    // session (see AuthController.RevokeToken) - a failure here must never block clearing
    // the browser's own cookies below, which is what lets the user leave the logged-in area.
    if (refreshToken) {
        await apiFetch("/api/auth/revoke-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
        }).catch(() => {});
    }

    const res = NextResponse.json({ success: true });

    res.cookies.set("token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
    })

    res.cookies.set("refresh_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
    })

    return res;
}
