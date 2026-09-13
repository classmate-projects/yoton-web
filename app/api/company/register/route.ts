import { apiFetch } from "@/lib/api";
import { ApiError } from "@/types/api";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const payload = await request.json();

    try {
        const data = await apiFetch("/api/company/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })

        // The refresh token must never reach client-side JS - see app/api/auth/login/route.ts.
        const { refreshToken, ...bodyWithoutRefreshToken } = data.body;
        const res = NextResponse.json({ ...data, body: bodyWithoutRefreshToken })

        res.cookies.set("token", data.body.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: 60 * 30, // matches the API's Jwt:AccessTokenMinutes
        })

        if (refreshToken) {
            res.cookies.set("refresh_token", refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                path: "/",
                maxAge: 60 * 60 * 24 * 30, // matches the API's Jwt:RefreshTokenDays
            })
        }

        return res;

    } catch (error: unknown) {
        const err = error as ApiError;
        return Response.json(err.body, {
            status: err.status,
        })
    }
}
