export interface BranchType {
  branchId: string;
  name: string;
  logoPath: string | null;
  isMain: boolean;
  isActive: boolean;
}

export interface BranchCreateType {
  name: string;
}

export interface BranchUpdateType {
  name: string;
}
