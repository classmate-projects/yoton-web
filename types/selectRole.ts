export interface AvailableRolesType {
  id: number;
  name: string;
  description: string;
  userRoles: null
}

export interface SelectRoleProps {
  role: string;
  setRole: React.Dispatch<React.SetStateAction<string>>;
  allRole: boolean;
  selectRole: boolean;
};