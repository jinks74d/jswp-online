// app/page.tsx
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/server";

export default async function HomePage() {
  // Check if user is already authenticated
  const session = await getAuthSession();
  
  if (session) {
    // Redirect to appropriate dashboard based on role
    const redirectPath = session.profile.role === "super_admin" 
      ? "/super-admin" 
      : "/dashboard";
    redirect(redirectPath);
  }
  
  // If not authenticated, redirect to login
  redirect("/login");
}