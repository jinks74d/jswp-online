/**
 * Teachers import descriptor — a school-user importer with role teacher.
 * Class-period assignment is a later (Classes) chunk; this just provisions the
 * teacher accounts at the school. See ./school-user.ts.
 *
 * SERVER ONLY.
 */

import "server-only";

import { makeSchoolUserDescriptor } from "./school-user";

export const teachersDescriptor = makeSchoolUserDescriptor({
  entity: "teachers",
  role: "teacher",
  roles: ["super_admin", "district_admin"],
  auditAction: "teacher.import",
});
