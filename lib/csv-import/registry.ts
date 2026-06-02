/**
 * Import-descriptor registry. The client passes an `entity` string; the server
 * resolves the descriptor here. Add a descriptor per entity as the build-out
 * proceeds (schools, admins, teachers, classes, students).
 *
 * SERVER ONLY — descriptors import the DB clients.
 */

import "server-only";

import type { ImportDescriptor } from "./descriptor";
import { districtsDescriptor } from "./descriptors/districts";

// Descriptors are stored type-erased (each has a different TRow); the generic
// core only uses the interface surface, and the typed descriptor enforces its
// own row shape internally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY: Record<string, ImportDescriptor<any>> = {
  districts: districtsDescriptor,
};

export function getDescriptor(
  entity: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): ImportDescriptor<any> | undefined {
  return REGISTRY[entity];
}
