import { apiFetch } from "@/lib/api";
import { ApiError } from "@/types/api";

export async function GET() {
    try {
        const data = await apiFetch("/api/patient")
        return Response.json(data.body)
    } catch (error) {
        console.log(error)
    }
}

export async function DELETE (req: Request) {
    try {
        const { id } = await req.json();
        const data = await apiFetch(`/api/patient/${id}`, {
            method: "DELETE"
        })

        return Response.json(data.body)

    } catch {
        return Response.json(
            { success: false },
            { status: 500 }
        )
    }
}


export async function  POST(req: Request) {
    const payload = await req.json();
    console.log("Payload: ", payload)

    try {
        const data = await apiFetch("/api/patient", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
        })

        return Response.json(data.body)
    } catch (error: unknown) {
        const err = error as ApiError;
        return Response.json(err.body, {
            status: err.status,
        })
    }
}