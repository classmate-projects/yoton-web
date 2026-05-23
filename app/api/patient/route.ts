import { apiFetch } from "@/lib/api";

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