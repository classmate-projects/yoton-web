export interface BranchType {
  branchId: string;
  name: string;
  isMain: boolean;
  isActive: boolean;
}

export interface BranchCreateType {
  name: string;
}
