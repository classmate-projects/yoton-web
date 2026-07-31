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

        const res = NextResponse.json(data)

        res.cookies.set("token", data.body.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
        })

        return res;

    } catch (error: unknown) {
        const err = error as ApiError;
        return Response.json(err.body, {
            status: err.status,
        })
    }
}
