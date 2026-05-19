import { apiFetch } from "@/lib/api";
import { NextRequest } from "next/server";

export async function GET() {
  try {
    const data = await apiFetch("/api/role");
    return Response.json(data);
  } catch {
    return Response.json(
        {message: "Failed to fetch roles"},
        {status: 500}
    )
  }
}


export async function DELETE(req: Request) {
    try {
        const { id } = await req.json();
        const data = await apiFetch(`/api/role/${id}`, {
            method: "DELETE"
        });

        return Response.json(data);
    } catch {
        return Response.json(
            {success: false},
            {status: 500}
        )
    }
}

export async function POST(req: Request) {
    const { name, description } = await req.json();
    try {
        const data = await apiFetch("/api/role", {
            method: "POST",
            headers: {
                "Content-Type" : "application/json"
            },
            body: JSON.stringify({name, description})
        })

        return Response.json(data.body, {
            status: data.status,
        });
    } catch {
        return Response.json({
            error: "Role creation failed"
        })
    }
}