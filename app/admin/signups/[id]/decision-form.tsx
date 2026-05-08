"use client";

/**
 * Two-mode form: approve (with editable role/district/school) or deny
 * (with required reason). Switches via radio at the top. Both share
 * an optional decision_notes (admin-only) field.
 *
 * For approved/denied requests we render a read-only summary instead.
 */

import { useActionState, useState } from "react";
import { AlertCircle, Loader2, Trash2 } from "lucide-react";
import {
  approveSignup,
  denySignup,
  deleteDeniedSignup,
  type DecisionFormState,
} from "@/lib/actions/signups";

export type DistrictOption = { id: string; name: string };
export type SchoolOption = { id: string; name: string; district_id: string };

const initialState: DecisionFormState = {};

export function DecisionForm({
  signupRequestId,
  status,
  denialReason,
  decisionNotes,
  defaultRole,
  defaultDistrictId,
  defaultSchoolId,
  districts,
  schools,
}: {
  signupRequestId: string;
  status: string;
  denialReason: string | null;
  decisionNotes: string | null;
  defaultRole: string;
  defaultDistrictId: string | null;
  defaultSchoolId: string | null;
  districts: DistrictOption[];
  schools: SchoolOption[];
}) {
  if (status === "approved") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
        This request was approved. The user&apos;s profile is active.
        {decisionNotes && (
          <div className="mt-2 text-xs text-green-700">
            <strong>Notes:</strong> {decisionNotes}
          </div>
        )}
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="space-y-3">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          This request was denied.
          {denialReason && (
            <div className="mt-2">
              <strong>Reason:</strong> {denialReason}
            </div>
          )}
          {decisionNotes && (
            <div className="mt-2 text-xs text-red-700">
              <strong>Internal notes:</strong> {decisionNotes}
            </div>
          )}
        </div>
        <DeleteButton signupRequestId={signupRequestId} />
      </div>
    );
  }

  return (
    <PendingDecision
      signupRequestId={signupRequestId}
      defaultRole={defaultRole}
      defaultDistrictId={defaultDistrictId}
      defaultSchoolId={defaultSchoolId}
      districts={districts}
      schools={schools}
    />
  );
}

function PendingDecision({
  signupRequestId,
  defaultRole,
  defaultDistrictId,
  defaultSchoolId,
  districts,
  schools,
}: {
  signupRequestId: string;
  defaultRole: string;
  defaultDistrictId: string | null;
  defaultSchoolId: string | null;
  districts: DistrictOption[];
  schools: SchoolOption[];
}) {
  const [mode, setMode] = useState<"approve" | "deny">("approve");
  const [districtId, setDistrictId] = useState<string>(
    defaultDistrictId ?? districts[0]?.id ?? ""
  );
  const [role, setRole] = useState<string>(defaultRole);
  const [approveState, approveAction, approving] = useActionState(
    approveSignup,
    initialState
  );
  const [denyState, denyAction, denying] = useActionState(
    denySignup,
    initialState
  );

  const filteredSchools = schools.filter((s) => s.district_id === districtId);
  const state = mode === "approve" ? approveState : denyState;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-1 w-fit">
        <button
          type="button"
          onClick={() => setMode("approve")}
          className={`px-4 py-1.5 text-sm font-medium rounded ${
            mode === "approve"
              ? "bg-green-600 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => setMode("deny")}
          className={`px-4 py-1.5 text-sm font-medium rounded ${
            mode === "deny"
              ? "bg-red-600 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          Deny
        </button>
      </div>

      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}

      {mode === "approve" ? (
        <form
          action={approveAction}
          className="space-y-4 bg-white border border-gray-200 rounded-lg p-6"
        >
          <input
            type="hidden"
            name="signup_request_id"
            value={signupRequestId}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <select
              name="role"
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
            >
              <option value="teacher">Teacher</option>
              <option value="school_admin">School administrator</option>
              <option value="district_admin">District administrator</option>
            </select>
            {approveState.fieldErrors?.role && (
              <p className="mt-1 text-sm text-red-600">
                {approveState.fieldErrors.role}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              District
            </label>
            <select
              name="district_id"
              required
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
            >
              <option value="">— Pick a district —</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {approveState.fieldErrors?.district_id && (
              <p className="mt-1 text-sm text-red-600">
                {approveState.fieldErrors.district_id}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              School{" "}
              {role === "district_admin" && (
                <span className="text-gray-500 font-normal">(optional)</span>
              )}
            </label>
            <select
              name="school_id"
              required={role !== "district_admin"}
              defaultValue={defaultSchoolId ?? ""}
              key={districtId}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
            >
              <option value="">
                {role === "district_admin" ? "— None —" : "— Pick a school —"}
              </option>
              {filteredSchools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {approveState.fieldErrors?.school_id && (
              <p className="mt-1 text-sm text-red-600">
                {approveState.fieldErrors.school_id}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="approve_notes"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Internal notes (optional, admin-only)
            </label>
            <textarea
              id="approve_notes"
              name="decision_notes"
              rows={2}
              maxLength={1000}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
            />
          </div>

          <button
            type="submit"
            disabled={approving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {approving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Approving…
              </>
            ) : (
              "Approve and create profile"
            )}
          </button>
        </form>
      ) : (
        <form
          action={denyAction}
          className="space-y-4 bg-white border border-gray-200 rounded-lg p-6"
        >
          <input
            type="hidden"
            name="signup_request_id"
            value={signupRequestId}
          />

          <div>
            <label
              htmlFor="denial_reason"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Reason for denial (shown to the user)
            </label>
            <textarea
              id="denial_reason"
              name="denial_reason"
              required
              rows={3}
              maxLength={1000}
              placeholder="e.g. We could not verify you teach at this school."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
            />
            {denyState.fieldErrors?.denial_reason && (
              <p className="mt-1 text-sm text-red-600">
                {denyState.fieldErrors.denial_reason}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="deny_notes"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Internal notes (optional, admin-only)
            </label>
            <textarea
              id="deny_notes"
              name="decision_notes"
              rows={2}
              maxLength={1000}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
            />
          </div>

          <button
            type="submit"
            disabled={denying}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {denying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending…
              </>
            ) : (
              "Deny request"
            )}
          </button>
        </form>
      )}
    </div>
  );
}

function DeleteButton({ signupRequestId }: { signupRequestId: string }) {
  return (
    <form action={deleteDeniedSignup}>
      <input type="hidden" name="signup_request_id" value={signupRequestId} />
      <button
        type="submit"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-red-300 bg-white text-sm text-red-700 hover:bg-red-50"
      >
        <Trash2 className="w-4 h-4" />
        Permanently delete request and account
      </button>
    </form>
  );
}
