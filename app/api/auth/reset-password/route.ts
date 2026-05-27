import { apiFetch } from "@/lib/api";
import { ApiError } from "@/types/api";

export async function POST(req: Request) {
    const {password, token} = await req.json();

    try {
        const data = await apiFetch("/api/auth/reset-password", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                token,
                newPassword: password
            }),
        })
        console.log("data : ", data.body)

        return Response.json(data)
    } catch (error: unknown) {
        console.log(error)
    }
}