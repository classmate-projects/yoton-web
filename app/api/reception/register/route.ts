import { apiFetch } from "@/lib/api";
import { ApiError } from "@/types/api";

export async function POST(req: Request) {
    try {
        const payload = await req.json();

        const data = await apiFetch("/api/reception/register", {
            method: "POST",
            headers: {
                "Content-Type" : "application/json"
            },
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