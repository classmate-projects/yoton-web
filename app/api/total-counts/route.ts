import { apiFetch } from "@/lib/api";

export async function GET() {
    try {
        const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBZG1pbiIsImV4cCI6MTc3OTA0MjcxOCwiaXNzIjoieW90b24tYXBpIiwiYXVkIjoieW90b24tY2xpZW50In0.XE7wtIKtOhqCxYESG5o5Fkd5tFk5B3JTR5zXrJSqdMM"
        const data = await apiFetch("/api/dashboard/counts", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            }
        });

        return Response.json(data);
    } catch {
        return Response.json(
            { message: "Failed to fetch total counts" },
            { status: 500 }
        )
    }
}