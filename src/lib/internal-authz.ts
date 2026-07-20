export type InternalRole = "super_admin" | "support" | "finance" | "operations" | "read_only_analyst";
export type InternalPermission = "view_platform" | "manage_support" | "view_finance" | "moderate_reviews" | "manage_business_status";

const permissions: Record<InternalRole, InternalPermission[]> = {
  super_admin: ["view_platform", "manage_support", "view_finance", "moderate_reviews", "manage_business_status"],
  support: ["view_platform", "manage_support", "moderate_reviews"],
  finance: ["view_platform", "view_finance"],
  operations: ["view_platform", "manage_support", "moderate_reviews", "manage_business_status"],
  read_only_analyst: ["view_platform"],
};

export function hasInternalPermission(role: InternalRole, permission: InternalPermission) {
  return permissions[role].includes(permission);
}
