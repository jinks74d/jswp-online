// app/dashboard/schools/page.tsx
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import SchoolsList from "@/components/dashboard/schools/SchoolsList";

export default async function SchoolsPage() {
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

  // Only district admins can manage schools
  if (profile.role !== "district_admin") {
    redirect("/dashboard");
  }

  // Fetch schools for this district
  const { data: schools, error } = await supabase
    .from("schools")
    .select("*")
    .eq("district_id", profile.district_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching schools:", error);
  }

  // Fetch user counts for each school
  const schoolsWithUserCounts = await Promise.all(
    (schools || []).map(async (school) => {
      try {
        const { count } = await supabase
          .from("user_profiles")
          .select("*", { count: "exact", head: true })
          .eq("school_id", school.id);

        return {
          ...school,
          user_count: count || 0,
        };
      } catch (error) {
        console.error(
          `Error fetching user count for school ${school.id}:`,
          error
        );
        return {
          ...school,
          user_count: 0,
        };
      }
    })
  );

  return (
    <SchoolsList
      schools={schoolsWithUserCounts || []}
      districtName={profile.districts?.name || "District"}
    />
  );
}
