export interface FetchedRoles {
    roleId: string;
    name: string;
    description: string;
    isEditable: boolean;
    isActive: boolean;
    createdAt: string
    iconKey?: string | null;
  }

export interface CreateRoleProps {
    name: string;
    description: string;
    iconKey?: string;
}

export interface UpdateRoleProps {
    name: string;
    description: string;
    isActive: boolean;
    iconKey?: string;
}