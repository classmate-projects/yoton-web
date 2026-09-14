import { ENDPOINTS } from "@/lib/endpoints"
import api from "@/lib/axios"
import { CreateRoleProps, UpdateRoleProps } from "@/types/role.type";

export const RoleService = {
    getAll: async () => {
        const { data } = await api.get(ENDPOINTS.ROLE.GET);
        return data;
    },

    create: async (payload: CreateRoleProps) => {
        const { data } = await api.post(ENDPOINTS.ROLE.CREATE, payload);
        return data;
    },

    update: async (id: string, payload: UpdateRoleProps) => {
        const { data } = await api.put(ENDPOINTS.ROLE.UPDATE(id), payload)
        return data;
    }, 

    delete: async (id: string) => {
        console.log(ENDPOINTS.ROLE.DELETE(id));
        const { data } = await api.delete(ENDPOINTS.ROLE.DELETE(id))
        return data;
    },

    getAllowedModules: async (id: string) => {
        const { data } = await api.get(ENDPOINTS.ROLE.GET_ALLOWED_MODULES(id));
        return data;
    },

    setAllowedModules: async (id: string, allowedModules: string[]) => {
        const { data } = await api.put(ENDPOINTS.ROLE.SET_ALLOWED_MODULES(id), { allowedModules });
        return data;
    },

    // Step-up re-auth (the caller's own password) required server-side - see
    // RoleController.ForceModule's comment on why granting one of these is deliberately
    // harder than the plain checklist.
    forceAssignModule: async (id: string, moduleKey: string, adminPassword: string) => {
        const { data } = await api.put(ENDPOINTS.ROLE.FORCE_MODULE(id), { moduleKey, adminPassword });
        return data;
    },

    revokeModule: async (id: string, moduleKey: string) => {
        const { data } = await api.put(ENDPOINTS.ROLE.REVOKE_MODULE(id), { moduleKey });
        return data;
    }
}