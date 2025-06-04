// app/dashboard/classes/create/page.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import CreateClassForm from "@/components/dashboard/classes/CreateClassForm";

export default async function CreateClassPage() {
  const cookieStore = await cookies();
  const supabase = await createServerSupabaseClient(cookieStore);

  // Get current user and profile
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/");
  }

  // Get user profile with school info
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select(
      `
      *,
      districts:district_id(id, name, domain),
      schools:school_id(id, name)
    `
    )
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/");
  }

  // Only school admins and district admins can create classes
  if (!["school_admin", "district_admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  // School admins must have a school
  if (profile.role === "school_admin" && !profile.school_id) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create Class</h1>
        <p className="text-gray-600 mt-1">
          Set up a new class with subject, class name, and period
        </p>
      </div>

      {/* Form */}
      <CreateClassForm profile={profile} />
    </div>
  );
}
