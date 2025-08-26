import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Papa from "papaparse";

interface StudentRow {
  student_email: string;
  first_name: string;
  last_name: string;
  grade_level?: string;
  class_period_ids?: string; // Comma-separated list
  teacher_emails?: string; // Comma-separated list
}

interface UploadStats {
  totalRows: number;
  studentsCreated: number;
  enrollmentsCreated: number;
  errors: string[];
  warnings: string[];
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (error) {
              console.warn("Failed to set cookies:", error);
            }
          },
        },
      }
    );

    // Verify authentication and permissions
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, school_id, district_id")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile ||
      !["school_admin", "district_admin"].includes(profile.role)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse request body
    const { sheetsUrl, schoolId } = await request.json();

    if (!sheetsUrl) {
      return NextResponse.json(
        { error: "Google Sheets URL is required" },
        { status: 400 }
      );
    }

    if (!schoolId) {
      return NextResponse.json(
        { error: "School ID is required" },
        { status: 400 }
      );
    }

    // Validate school access
    if (profile.role === "school_admin" && schoolId !== profile.school_id) {
      return NextResponse.json(
        { error: "Invalid school access" },
        { status: 403 }
      );
    }

    if (profile.role === "district_admin") {
      // Verify the school belongs to the district
      const { data: school } = await supabase
        .from("schools")
        .select("district_id")
        .eq("id", schoolId)
        .single();

      if (!school || school.district_id !== profile.district_id) {
        return NextResponse.json(
          { error: "School not in your district" },
          { status: 403 }
        );
      }
    }

    // Extract spreadsheet ID from the URL
    const spreadsheetIdMatch = sheetsUrl.match(
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/
    );
    
    if (!spreadsheetIdMatch) {
      return NextResponse.json(
        {
          error: "Invalid Google Sheets URL",
          message: "Please provide a valid Google Sheets share URL",
        },
        { status: 400 }
      );
    }

    const spreadsheetId = spreadsheetIdMatch[1];
    
    // Convert to CSV export URL
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

    // Fetch the CSV data
    let csvContent: string;
    try {
      const response = await fetch(csvUrl);
      
      if (!response.ok) {
        if (response.status === 404) {
          return NextResponse.json(
            {
              error: "Spreadsheet not found",
              message: "Please make sure the spreadsheet is shared with 'Anyone with the link can view'",
            },
            { status: 400 }
          );
        }
        throw new Error(`Failed to fetch spreadsheet: ${response.status}`);
      }
      
      csvContent = await response.text();
    } catch (error) {
      console.error("Error fetching Google Sheets:", error);
      return NextResponse.json(
        {
          error: "Failed to fetch Google Sheets",
          message: "Please ensure the spreadsheet is publicly accessible (Anyone with the link can view)",
        },
        { status: 400 }
      );
    }

    // Parse CSV data using PapaParse
    const parseResult = Papa.parse<StudentRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/ /g, "_"),
    });

    if (parseResult.errors.length > 0) {
      console.error("CSV parsing errors:", parseResult.errors);
      return NextResponse.json(
        {
          error: "Failed to parse spreadsheet data",
          message: "Please ensure your spreadsheet follows the correct format",
          details: parseResult.errors.slice(0, 5).map(e => e.message),
        },
        { status: 400 }
      );
    }

    const rows = parseResult.data;

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: "No data found",
          message: "The spreadsheet appears to be empty or incorrectly formatted",
        },
        { status: 400 }
      );
    }

    // Check for duplicate emails within the uploaded file
    const duplicateCheck = new Map<string, number[]>();
    rows.forEach((row, index) => {
      if (row.student_email) {
        const email = row.student_email.trim().toLowerCase();
        if (!duplicateCheck.has(email)) {
          duplicateCheck.set(email, []);
        }
        duplicateCheck.get(email)!.push(index + 2); // +2 for header and 0-based index
      }
    });

    // Process the data
    const stats: UploadStats = {
      totalRows: rows.length,
      studentsCreated: 0,
      enrollmentsCreated: 0,
      errors: [],
      warnings: [],
    };

    // Report duplicates as warnings
    duplicateCheck.forEach((rowNumbers, email) => {
      if (rowNumbers.length > 1) {
        stats.warnings.push(
          `Duplicate email found: "${email}" in rows: ${rowNumbers.join(", ")}`
        );
      }
    });

    // Track processed students to avoid duplicates
    const processedStudents = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because of header row and 0-based index

      try {
        // Validate required fields
        if (!row.student_email?.trim()) {
          stats.errors.push(`Row ${rowNum}: Student email is required`);
          continue;
        }
        if (!row.first_name?.trim()) {
          stats.errors.push(`Row ${rowNum}: First name is required`);
          continue;
        }
        if (!row.last_name?.trim()) {
          stats.errors.push(`Row ${rowNum}: Last name is required`);
          continue;
        }

        const studentEmail = row.student_email.trim().toLowerCase();
        const firstName = row.first_name.trim();
        const lastName = row.last_name.trim();
        const gradeLevel = row.grade_level?.trim() || null;

        // Skip if already processed
        if (processedStudents.has(studentEmail)) {
          stats.warnings.push(
            `Row ${rowNum}: Skipping duplicate email "${studentEmail}"`
          );
          continue;
        }

        // 1. Create or get student user profile
        let studentId: string;

        // Check if student already exists
        const { data: existingStudent } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("email", studentEmail)
          .eq("role", "student")
          .eq("school_id", schoolId)
          .maybeSingle();

        if (existingStudent?.id) {
          studentId = existingStudent.id as string;
          stats.warnings.push(
            `Row ${rowNum}: Student "${studentEmail}" already exists`
          );
        } else {
          // Create new student profile
          const { data: newStudent, error: studentError } = await supabase
            .from("user_profiles")
            .insert({
              email: studentEmail,
              first_name: firstName,
              last_name: lastName,
              role: "student",
              school_id: schoolId,
              district_id: profile.district_id,
              metadata: gradeLevel ? { grade_level: gradeLevel } : null,
            })
            .select("id")
            .single();

          if (studentError) {
            stats.errors.push(
              `Row ${rowNum}: Failed to create student "${studentEmail}": ${studentError.message}`
            );
            continue;
          }

          studentId = newStudent.id as string;
          stats.studentsCreated++;
        }

        // Mark as processed
        processedStudents.add(studentEmail);

        // 2. Handle class enrollments if specified
        if (row.class_period_ids?.trim()) {
          const classPeriodIds = row.class_period_ids
            .split(",")
            .map(id => id.trim())
            .filter(id => id);

          for (const classPeriodId of classPeriodIds) {
            try {
              // Verify the class period exists and belongs to the school
              const { data: classPeriod, error: periodError } = await supabase
                .from("class_periods")
                .select("id")
                .eq("id", classPeriodId)
                .eq("school_id", schoolId)
                .maybeSingle();

              if (periodError || !classPeriod) {
                stats.warnings.push(
                  `Row ${rowNum}: Class period "${classPeriodId}" not found in school`
                );
                continue;
              }

              // Check if enrollment already exists
              const { data: existingEnrollment } = await supabase
                .from("class_student_enrollments")
                .select("id")
                .eq("class_period_id", classPeriodId)
                .eq("student_id", studentId)
                .maybeSingle();

              if (!existingEnrollment) {
                // Create enrollment
                const { error: enrollmentError } = await supabase
                  .from("class_student_enrollments")
                  .insert({
                    class_period_id: classPeriodId,
                    student_id: studentId,
                    enrolled_by: user.id,
                    school_id: schoolId,
                  });

                if (enrollmentError) {
                  stats.warnings.push(
                    `Row ${rowNum}: Failed to enroll student in class "${classPeriodId}": ${enrollmentError.message}`
                  );
                } else {
                  stats.enrollmentsCreated++;
                }
              } else {
                stats.warnings.push(
                  `Row ${rowNum}: Student already enrolled in class "${classPeriodId}"`
                );
              }
            } catch (error) {
              stats.warnings.push(
                `Row ${rowNum}: Error processing class enrollment "${classPeriodId}": ${
                  error instanceof Error ? error.message : "Unknown error"
                }`
              );
            }
          }
        }

        // 3. Handle teacher associations if specified (for informational purposes)
        if (row.teacher_emails?.trim()) {
          const teacherEmails = row.teacher_emails
            .split(",")
            .map(email => email.trim().toLowerCase())
            .filter(email => email);

          for (const teacherEmail of teacherEmails) {
            // Verify teacher exists in the school
            const { data: teacher } = await supabase
              .from("user_profiles")
              .select("id, first_name, last_name")
              .eq("email", teacherEmail)
              .eq("role", "teacher")
              .eq("school_id", schoolId)
              .maybeSingle();

            if (!teacher) {
              stats.warnings.push(
                `Row ${rowNum}: Teacher "${teacherEmail}" not found in school`
              );
            }
          }
        }
      } catch (error) {
        console.error(`Error processing row ${rowNum}:`, error);
        stats.errors.push(
          `Row ${rowNum}: Unexpected error - ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    const successCount = stats.studentsCreated + stats.enrollmentsCreated;
    const hasErrors = stats.errors.length > 0;

    return NextResponse.json({
      success: !hasErrors || successCount > 0,
      message: hasErrors
        ? `Import completed with ${stats.errors.length} errors. ${successCount} items created successfully.`
        : `Import successful! Created ${stats.studentsCreated} students and ${stats.enrollmentsCreated} class enrollments.`,
      stats,
    });
  } catch (error) {
    console.error("Google Sheets student import error:", error);
    return NextResponse.json(
      {
        error: "Import failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}