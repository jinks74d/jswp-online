import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Papa from "papaparse";

interface ClassRow {
  subject_name: string;
  class_name: string;
  period: string;
  teacher_email?: string;
  subject_description?: string;
}

interface UploadStats {
  totalRows: number;
  subjectsCreated: number;
  classesCreated: number;
  classPeriodsCreated: number;
  teachersAssigned: number;
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
    const parseResult = Papa.parse<ClassRow>(csvContent, {
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

    // Process the data (similar to bulk-upload route)
    const stats: UploadStats = {
      totalRows: rows.length,
      subjectsCreated: 0,
      classesCreated: 0,
      classPeriodsCreated: 0,
      teachersAssigned: 0,
      errors: [],
      warnings: [],
    };

    // Track created items to avoid duplicates
    const createdSubjects = new Map<string, string>();
    const createdClasses = new Map<string, string>();

    // Use database transaction for atomicity
    const processResults = await supabase.rpc('process_bulk_class_upload', {
      upload_data: rows,
      school_id: schoolId,
      user_id: user.id,
    }).single();

    // If RPC doesn't exist, fall back to manual processing
    if (processResults.error && processResults.error.code === 'PGRST202') {
      // Process rows manually (same logic as bulk-upload route)
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        try {
          // Validate required fields
          if (!row.subject_name?.trim()) {
            stats.errors.push(`Row ${rowNum}: Subject name is required`);
            continue;
          }
          if (!row.class_name?.trim()) {
            stats.errors.push(`Row ${rowNum}: Class name is required`);
            continue;
          }
          if (!row.period?.trim()) {
            stats.errors.push(`Row ${rowNum}: Period is required`);
            continue;
          }

          const subjectName = row.subject_name.trim();
          const className = row.class_name.trim();
          const period = row.period.trim();
          const teacherEmail = row.teacher_email?.trim();
          const subjectDescription = row.subject_description?.trim();

          // 1. Create or get subject
          let subjectId = createdSubjects.get(subjectName);
          if (!subjectId) {
            const { data: existingSubject } = await supabase
              .from("subjects")
              .select("id")
              .eq("name", subjectName)
              .eq("school_id", schoolId)
              .single();

            if (existingSubject?.id) {
              subjectId = existingSubject.id as string;
              createdSubjects.set(subjectName, subjectId);
            } else {
              const { data: newSubject, error: subjectError } = await supabase
                .from("subjects")
                .insert({
                  name: subjectName,
                  description: subjectDescription || null,
                  school_id: schoolId,
                })
                .select("id")
                .single();

              if (subjectError) {
                stats.errors.push(
                  `Row ${rowNum}: Failed to create subject "${subjectName}": ${subjectError.message}`
                );
                continue;
              }

              subjectId = newSubject.id as string;
              createdSubjects.set(subjectName, subjectId);
              stats.subjectsCreated++;
            }
          }

          // 2. Create or get class
          const classKey = `${className}+${subjectId}`;
          let classId = createdClasses.get(classKey);
          if (!classId) {
            const { data: existingClass } = await supabase
              .from("classes")
              .select("id")
              .eq("name", className)
              .eq("subject_id", subjectId)
              .single();

            if (existingClass?.id) {
              classId = existingClass.id as string;
              createdClasses.set(classKey, classId);
            } else {
              const { data: newClass, error: classError } = await supabase
                .from("classes")
                .insert({
                  name: className,
                  subject_id: subjectId,
                  school_id: schoolId,
                })
                .select("id")
                .single();

              if (classError) {
                stats.errors.push(
                  `Row ${rowNum}: Failed to create class "${className}": ${classError.message}`
                );
                continue;
              }

              classId = newClass.id as string;
              createdClasses.set(classKey, classId);
              stats.classesCreated++;
            }
          }

          // 3. Create class period
          const { data: existingPeriod } = await supabase
            .from("class_periods")
            .select("id")
            .eq("class_id", classId)
            .eq("period", period)
            .single();

          let classPeriodId: string;
          if (existingPeriod) {
            classPeriodId = existingPeriod.id as string;
            stats.warnings.push(
              `Row ${rowNum}: Class period "${className} - ${period}" already exists`
            );
          } else {
            const { data: newPeriod, error: periodError } = await supabase
              .from("class_periods")
              .insert({
                class_id: classId,
                period: period,
                school_id: schoolId,
                created_by: user.id,
              })
              .select("id")
              .single();

            if (periodError) {
              stats.errors.push(
                `Row ${rowNum}: Failed to create class period "${period}": ${periodError.message}`
              );
              continue;
            }

            classPeriodId = newPeriod.id as string;
            stats.classPeriodsCreated++;
          }

          // 4. Assign teacher if provided
          if (teacherEmail) {
            const { data: teacher } = await supabase
              .from("user_profiles")
              .select("id")
              .eq("email", teacherEmail.toLowerCase())
              .eq("role", "teacher")
              .eq("school_id", schoolId)
              .single();

            if (teacher) {
              const { data: existingAssignment } = await supabase
                .from("class_teacher_assignments")
                .select("id")
                .eq("class_period_id", classPeriodId)
                .eq("teacher_id", teacher.id)
                .single();

              if (!existingAssignment) {
                const { error: assignmentError } = await supabase
                  .from("class_teacher_assignments")
                  .insert({
                    class_period_id: classPeriodId,
                    teacher_id: teacher.id,
                    assigned_by: user.id,
                    school_id: schoolId,
                  });

                if (assignmentError) {
                  stats.warnings.push(
                    `Row ${rowNum}: Failed to assign teacher "${teacherEmail}": ${assignmentError.message}`
                  );
                } else {
                  stats.teachersAssigned++;
                }
              } else {
                stats.warnings.push(
                  `Row ${rowNum}: Teacher "${teacherEmail}" already assigned to this class period`
                );
              }
            } else {
              stats.warnings.push(
                `Row ${rowNum}: Teacher "${teacherEmail}" not found in school`
              );
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
    } else if (processResults.data) {
      // Use RPC results if available
      return NextResponse.json({
        success: true,
        message: "Google Sheets data imported successfully",
        stats: processResults.data,
      });
    }

    const successCount =
      stats.subjectsCreated + stats.classesCreated + stats.classPeriodsCreated;
    const hasErrors = stats.errors.length > 0;

    return NextResponse.json({
      success: !hasErrors || successCount > 0,
      message: hasErrors
        ? `Import completed with ${stats.errors.length} errors. ${successCount} items created successfully.`
        : `Import successful! Created ${stats.subjectsCreated} subjects, ${stats.classesCreated} classes, and ${stats.classPeriodsCreated} class periods.`,
      stats,
    });
  } catch (error) {
    console.error("Google Sheets import error:", error);
    return NextResponse.json(
      {
        error: "Import failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}