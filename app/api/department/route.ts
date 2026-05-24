import { apiFetch } from "@/lib/api";
import { ApiError } from "@/types/api";

export async function GET() {
    try {
        const data = await apiFetch("/api/department");
        return Response.json(data.body)
    } catch (error: unknown) {
        const err = error as ApiError;
        return Response.json(err.body, {
            status: err.status
        })

    }
}

export async function POST(req: Request) {
    const { name, description } = await req.json();

    try {
        const data = await apiFetch("/api/department", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, description })
        })

        return Response.json(data.body)
    } catch (error: unknown) {
        const err = error as ApiError;
        return Response.json(err.body, {
            status: err.status
        })
    }
}

export async function DELETE(req: Request) {
    const id = await req.json();
    try {
        const data = await apiFetch(`/api/department/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application-json" },
        })

        return Response.json(data.body)
    } catch (error: unknown) {
        const err = error as ApiError;
        return Response.json(err.body, {
            status: err.status
        })
    }
}