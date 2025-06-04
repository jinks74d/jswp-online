// app/dashboard/schools/[id]/page.tsx
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect, notFound } from "next/navigation";
import SchoolDetails from "@/components/dashboard/schools/SchoolDetails";

interface PageProps {
  params: { id: string };
}

export default async function SchoolDetailsPage({ params }: PageProps) {
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
      districts:district_id(id, name)
    `
    )
    .eq("id", user.id)
    .single();

  if (!profile || !profile.district_id) {
    redirect("/");
  }

  // Only district admins can view school details
  if (profile.role !== "district_admin") {
    redirect("/dashboard");
  }

  // Fetch school details
  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select(
      `
      *,
      districts:district_id(id, name)
    `
    )
    .eq("id", params.id)
    .eq("district_id", profile.district_id) // Ensure school belongs to user's district
    .single();

  if (schoolError || !school) {
    notFound();
  }

  // Fetch school users with role counts
  const { data: users } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("school_id", params.id)
    .order("created_at", { ascending: false });

  // Fetch recent assignments for this school
  const { data: assignments } = await supabase
    .from("assignments")
    .select(
      `
      *,
      teacher:teacher_id(first_name, last_name)
    `
    )
    .eq("school_id", params.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const userStats = {
    total: users?.length || 0,
    school_admin: users?.filter((u) => u.role === "school_admin").length || 0,
    teacher: users?.filter((u) => u.role === "teacher").length || 0,
    student: users?.filter((u) => u.role === "student").length || 0,
  };

  return (
    <SchoolDetails
      school={school}
      users={users || []}
      assignments={assignments || []}
      userStats={userStats}
      districtName={profile.districts?.name || "District"}
    />
  );
}
