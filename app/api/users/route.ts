import { apiFetch } from "@/lib/api";

export async function GET() {
    try {
        const data = await apiFetch("/api/user");
        console.log("Fetched users:", data);

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