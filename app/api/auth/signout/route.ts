// app/api/auth/signout/route.ts
import { NextResponse } from "next/server";
import { authService } from "@/lib/auth/service";

export async function POST() {
  try {
    const result = await authService.signOut();
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Signout API error:", error);
    return NextResponse.json(
      { error: "An error occurred during sign out" },
      { status: 500 }
    );
  }
}