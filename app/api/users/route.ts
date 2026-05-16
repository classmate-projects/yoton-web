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