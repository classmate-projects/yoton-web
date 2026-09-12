import { apiFetch } from "@/lib/api";
import { ApiError } from "@/types/api";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Called by lib/axios.ts's response interceptor whenever an API call comes back 401 - the
// access token is short-lived by design (Jwt:AccessTokenMinutes), so this is the normal,
// expected path for keeping a session alive rather than an error case. The refresh token
// itself lives only in this route's httpOnly cookie; it's read here, never handed to the
// browser, and always rotated (see AuthController.RefreshToken) so it's single-use.
export async function POST() {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;

    if (!refreshToken) {
        return NextResponse.json({ message: "No refresh token" }, { status: 401 });
    }

    try {
        const data = await apiFetch("/api/auth/refresh-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
        });

        const res = NextResponse.json({ token: data.body.token });

        res.cookies.set("token", data.body.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: 60 * 30,
        });

        res.cookies.set("refresh_token", data.body.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: 60 * 60 * 24 * 30,
        });

        return res;
    } catch (error: unknown) {
        const err = error as ApiError;

        // The refresh token is dead (expired, revoked, or reuse-detected) - clear both
        // cookies so proxy.ts's page-gating middleware stops seeing a stale "token" cookie
        // and bounces the next navigation to /login instead of looping.
        const res = NextResponse.json(err.body ?? { message: "Refresh failed" }, {
            status: err.status ?? 401,
        });
        res.cookies.set("token", "", { path: "/", maxAge: 0 });
        res.cookies.set("refresh_token", "", { path: "/", maxAge: 0 });
        return res;
    }
}
