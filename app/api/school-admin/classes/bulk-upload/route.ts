import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
      .select("role, school_id")
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

    if (!schoolId || schoolId !== profile.school_id) {
      return NextResponse.json({ error: "Invalid school" }, { status: 400 });
    }

    // Read and parse file
    const fileContent = await file.text();
    const rows = parseCSV(fileContent);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: "No valid data found in file",
        },
        { status: 400 }
      );
    }

    // Process the data
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
    const createdSubjects = new Map<string, string>(); // name -> id
    const createdClasses = new Map<string, string>(); // name+subject -> id

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because of header row and 0-based index

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
          // Check if subject already exists
          const { data: existingSubject } = await supabase
            .from("subjects")
            .select("id")
            .eq("name", subjectName)
            .eq("school_id", schoolId)
            .single();

          if (existingSubject && existingSubject.id) {
            subjectId = existingSubject.id;
            createdSubjects.set(subjectName, subjectId as string);
          } else {
            // Create new subject
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

            subjectId = newSubject.id;
            createdSubjects.set(subjectName, subjectId as string);
            stats.subjectsCreated++;
          }
        }

        // 2. Create or get class
        const classKey = `${className}+${subjectId}`;
        let classId = createdClasses.get(classKey);
        if (!classId) {
          // Check if class already exists
          const { data: existingClass } = await supabase
            .from("classes")
            .select("id")
            .eq("name", className)
            .eq("subject_id", subjectId)
            .single();

          if (existingClass && existingClass.id) {
            classId = existingClass.id;
            createdClasses.set(classKey, classId as string);
          } else {
            // Create new class
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

            classId = newClass.id;
            createdClasses.set(classKey, classId as string);
            stats.classesCreated++;
          }
        }

        // 3. Create class period
        // Check if class period already exists
        const { data: existingPeriod } = await supabase
          .from("class_periods")
          .select("id")
          .eq("class_id", classId)
          .eq("period", period)
          .single();

        let classPeriodId: string;
        if (existingPeriod) {
          classPeriodId = existingPeriod.id;
          stats.warnings.push(
            `Row ${rowNum}: Class period "${className} - ${period}" already exists`
          );
        } else {
          // Create new class period
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

          classPeriodId = newPeriod.id;
          stats.classPeriodsCreated++;
        }

        // 4. Assign teacher if provided
        if (teacherEmail) {
          // Find teacher by email
          const { data: teacher } = await supabase
            .from("user_profiles")
            .select("id")
            .eq("email", teacherEmail.toLowerCase())
            .eq("role", "teacher")
            .eq("school_id", schoolId)
            .single();

          if (teacher) {
            // Check if teacher is already assigned to this class period
            const { data: existingAssignment } = await supabase
              .from("class_teacher_assignments")
              .select("id")
              .eq("class_period_id", classPeriodId)
              .eq("teacher_id", teacher.id)
              .single();

            if (!existingAssignment) {
              // Assign teacher to class period
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

    const successCount =
      stats.subjectsCreated + stats.classesCreated + stats.classPeriodsCreated;
    const hasErrors = stats.errors.length > 0;

    return NextResponse.json({
      success: !hasErrors || successCount > 0,
      message: hasErrors
        ? `Upload completed with ${stats.errors.length} errors. ${successCount} items created successfully.`
        : `Upload successful! Created ${stats.subjectsCreated} subjects, ${stats.classesCreated} classes, and ${stats.classPeriodsCreated} class periods.`,
      stats,
    });
  } catch (error) {
    console.error("Bulk upload error:", error);
    return NextResponse.json(
      {
        error: "Upload failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function parseCSV(content: string): ClassRow[] {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
  const rows: ClassRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: any = {};
    headers.forEach((header, index) => {
      if (values[index] !== undefined) {
        row[header] = values[index].trim();
      }
    });

    // Only include rows with at least the required fields
    if (row.subject_name || row.class_name || row.period) {
      rows.push(row as ClassRow);
    }
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map((val) => val.replace(/"/g, ""));
}
