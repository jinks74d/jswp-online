// app/dashboard/classes/[id]/page.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase";
import ClassDetail from "@/components/dashboard/classes/ClassDetail";

interface ClassDetailPageProps {
  params: {
    id: string;
  };
}

export default async function ClassDetailPage({ params }: ClassDetailPageProps) {
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

  // Get class period details
  const { data: classPeriod, error: classPeriodError } = await supabase
    .from("class_periods")
    .select(`
      *,
      classes:class_id(
        id,
        name,
        subjects:subject_id(
          id,
          name,
          description
        )
      )
    `)
    .eq("id", params.id)
    .eq("school_id", profile.school_id)
    .single();

  if (classPeriodError || !classPeriod) {
    redirect("/dashboard/classes");
  }

  return (
    <div className="space-y-6">
      <ClassDetail
        classPeriod={classPeriod}
        profile={profile}
      />
    </div>
  );
}
