import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Papa from "papaparse";
import * as XLSX from "xlsx";

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

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const schoolId = formData.get("schoolId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!schoolId) {
      return NextResponse.json({ error: "School ID is required" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "File too large",
          message: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        },
        { status: 400 }
      );
    }

    // Validate school access
    if (profile.role === "school_admin") {
      if (schoolId !== profile.school_id) {
        return NextResponse.json(
          { error: "Invalid school access" },
          { status: 403 }
        );
      }
    } else if (profile.role === "district_admin") {
      // For district admins, verify the school belongs to their district
      const { data: school, error: schoolError } = await supabase
        .from("schools")
        .select("district_id")
        .eq("id", schoolId)
        .single();

      if (schoolError || !school || school.district_id !== profile.district_id) {
        return NextResponse.json(
          { error: "School not in your district" },
          { status: 403 }
        );
      }
    }

    // Parse file based on type
    let rows: StudentRow[] = [];
    const fileName = file.name.toLowerCase();
    
    try {
      if (fileName.endsWith(".csv")) {
        // Parse CSV with PapaParse
        const fileContent = await file.text();
        const parseResult = Papa.parse<StudentRow>(fileContent, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim().toLowerCase().replace(/ /g, "_"),
        });

        if (parseResult.errors.length > 0) {
          console.error("CSV parsing errors:", parseResult.errors);
          return NextResponse.json(
            {
              error: "Failed to parse CSV file",
              message: "Please ensure your CSV file is properly formatted",
              details: parseResult.errors.slice(0, 5).map(e => e.message),
            },
            { status: 400 }
          );
        }

        rows = parseResult.data;
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        // Parse Excel with xlsx
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        
        // Get the first worksheet
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          return NextResponse.json(
            {
              error: "Empty Excel file",
              message: "The Excel file appears to be empty",
            },
            { status: 400 }
          );
        }

        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, {
          raw: false,
          defval: "",
        });

        // Transform headers to match expected format with input sanitization
        rows = jsonData.map((row: any) => {
          const transformedRow: any = {};
          Object.keys(row).forEach(key => {
            const normalizedKey = key.trim().toLowerCase().replace(/ /g, "_");
            // Sanitize input values to prevent CSV injection and XSS
            let value = row[key];
            if (typeof value === 'string') {
              // Remove potential CSV formula injection characters
              value = value.replace(/^[@=+\-]/g, '');
              // Trim and sanitize
              value = value.trim();
              // Limit length to prevent DoS
              value = value.substring(0, 1000);
            }
            transformedRow[normalizedKey] = value;
          });
          return transformedRow as StudentRow;
        });
      } else {
        return NextResponse.json(
          {
            error: "Invalid file type",
            message: "Please upload a CSV or Excel file (.csv, .xlsx, .xls)",
          },
          { status: 400 }
        );
      }
    } catch (parseError) {
      console.error("File parsing error:", parseError);
      return NextResponse.json(
        {
          error: "Failed to parse file",
          message: parseError instanceof Error ? parseError.message : "Unknown parsing error",
        },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: "No valid data found in file",
          message: "The file appears to be empty or incorrectly formatted",
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
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        stats.errors.push(`Row ${rowNum}: Unexpected error - ${errorMessage}`);
      }
    }

    const successCount = stats.studentsCreated + stats.enrollmentsCreated;
    const hasErrors = stats.errors.length > 0;

    return NextResponse.json({
      success: !hasErrors || successCount > 0,
      message: hasErrors
        ? `Upload completed with ${stats.errors.length} errors. ${successCount} items created successfully.`
        : `Upload successful! Created ${stats.studentsCreated} students and ${stats.enrollmentsCreated} class enrollments.`,
      stats,
    });
  } catch (error) {
    console.error("Student bulk upload error:", error);
    return NextResponse.json(
      {
        error: "Upload failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}