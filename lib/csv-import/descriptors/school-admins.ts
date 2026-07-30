/**
 * School-admins import descriptor — a school-user importer with role
 * school_admin. See ./school-user.ts for the shared mechanism.
 *
 * SERVER ONLY.
 */

import "server-only";

import { makeSchoolUserDescriptor } from "./school-user";

export const schoolAdminsDescriptor = makeSchoolUserDescriptor({
  entity: "school_admins",
  role: "school_admin",
  roles: ["super_admin", "district_admin"],
  auditAction: "school_admin.import",
});
