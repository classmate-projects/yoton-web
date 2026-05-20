import { apiFetch } from "@/lib/api";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const { emailOrUserName, password } = await request.json();

    try {
        const data = await apiFetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type" : "application/json"
            }, 
            body: JSON.stringify({ emailOrUserName, password })
        })

        const res = NextResponse.json(data)

        res.cookies.set("token", data.body.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
        })

        return res;
    } catch {
        return Response.json({ error: "Login failed" }, { status: 401 });
    }
}