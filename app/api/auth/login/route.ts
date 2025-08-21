// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/lib/auth/service";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Attempt sign in
    const result = await authService.signIn(email, password);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 401 }
      );
    }

    // Get redirect path based on role
    const redirectTo = authService.getRedirectPath(result.data.profile.role);
    
    return NextResponse.json({
      success: true,
      redirectTo,
      user: {
        id: result.data.user.id,
        email: result.data.user.email,
      },
      profile: result.data.profile,
    });
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { error: "An error occurred during login" },
      { status: 500 }
    );
  }
}