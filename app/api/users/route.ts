import { apiFetch } from "@/lib/api";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const data = await apiFetch("/api/user");

        return Response.json(data);
    } catch  {
        return Response.json({ error: "Failed to fetch users" }, { status: 500 });
    }
}


export async function DELETE(req: Request) {
    try {
        const { id } = await req.json();
        const data = await apiFetch(`/api/user/${id}`, { method: "DELETE"});

        return Response.json(data);

    } catch {
        return Response.json(
            {success: false},
            {status: 500}
        )
    }
}


export async function POST(request: Request) {
    const { fullname, username, email, password, role, phone } = await request.json();

    try {
        const data = await apiFetch("/api/user", {
            method: "POST",
            headers: {
                "Content-Type" : "application/json"
            },
            body: JSON.stringify({
                fullName: fullname,
                username,
                email,
                passwordHash: password,
                role,
                phone
            })
        })

        return NextResponse.json(data);
    } catch {
        return Response.json({
            error: "User regestration failed"
        })
    }
}