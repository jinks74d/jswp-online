// app/dashboard/assignments/create/page.tsx
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import WritingStyleSelection from "@/components/dashboard/assignments/WritingStyleSelection";

export default async function CreateAssignmentPage() {
  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient(cookieStore);

  // Get current user and verify permissions
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select(
      `
      *,
      districts:district_id(id, name),
      schools:school_id(id, name)
    `
    )
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/");
  }

  // Only teachers, school admins, and district admins can create assignments
  if (!["teacher", "school_admin", "district_admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  return (
    <WritingStyleSelection
      currentUserRole={profile.role}
      currentUserSchool={profile.schools}
      districtName={profile.districts?.name || "District"}
    />
  );
}
