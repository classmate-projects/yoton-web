export interface CreateRoleProps {
    name: string;
    description: string;
}

export interface UpdateRoleProps {
    name: string;
    description: string;
    isActive: boolean;
}