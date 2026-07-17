export interface FetchedRoles {
    roleId: string;
    name: string;
    description: string;
    isEditable: boolean;
    isActive: boolean;
    createdAt: string
  }

export interface CreateRoleProps {
    name: string;
    description: string;
}

export interface UpdateRoleProps {
    name: string;
    description: string;
    isActive: boolean;
}