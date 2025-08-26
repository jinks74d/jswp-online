import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Papa from "papaparse";
import * as XLSX from "xlsx";

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

    // Validate school access - Fixed for district admins
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
    let rows: ClassRow[] = [];
    const fileName = file.name.toLowerCase();
    
    try {
      if (fileName.endsWith(".csv")) {
        // Parse CSV with PapaParse
        const fileContent = await file.text();
        const parseResult = Papa.parse<ClassRow>(fileContent, {
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
          return transformedRow as ClassRow;
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

    // Check for duplicates within the uploaded file
    const duplicateCheck = new Map<string, number[]>();
    rows.forEach((row, index) => {
      if (row.subject_name && row.class_name && row.period) {
        const key = `${row.subject_name.trim()}_${row.class_name.trim()}_${row.period.trim()}`;
        if (!duplicateCheck.has(key)) {
          duplicateCheck.set(key, []);
        }
        duplicateCheck.get(key)!.push(index + 2); // +2 for header and 0-based index
      }
    });

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

    // Report duplicates as warnings
    duplicateCheck.forEach((rowNumbers, key) => {
      if (rowNumbers.length > 1) {
        const [subject, className, period] = key.split("_");
        stats.warnings.push(
          `Duplicate entry found for "${subject} - ${className} - ${period}" in rows: ${rowNumbers.join(", ")}`
        );
      }
    });

    // Track created items to avoid duplicates
    const createdSubjects = new Map<string, string>();
    const createdClasses = new Map<string, string>();
    const processedPeriods = new Set<string>();

    // Process rows with better error handling and transaction-like approach
    const errors: Array<{ row: number; error: string }> = [];
    const successful: Array<{ row: number; data: any }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because of header row and 0-based index

      try {
        // Validate required fields
        if (!row.subject_name?.trim()) {
          errors.push({ row: rowNum, error: "Subject name is required" });
          stats.errors.push(`Row ${rowNum}: Subject name is required`);
          continue;
        }
        if (!row.class_name?.trim()) {
          errors.push({ row: rowNum, error: "Class name is required" });
          stats.errors.push(`Row ${rowNum}: Class name is required`);
          continue;
        }
        if (!row.period?.trim()) {
          errors.push({ row: rowNum, error: "Period is required" });
          stats.errors.push(`Row ${rowNum}: Period is required`);
          continue;
        }

        const subjectName = row.subject_name.trim();
        const className = row.class_name.trim();
        const period = row.period.trim();
        const teacherEmail = row.teacher_email?.trim();
        const subjectDescription = row.subject_description?.trim();

        // Check if this period was already processed (skip duplicates)
        const periodKey = `${subjectName}_${className}_${period}`;
        if (processedPeriods.has(periodKey)) {
          stats.warnings.push(
            `Row ${rowNum}: Skipping duplicate entry for "${subjectName} - ${className} - ${period}"`
          );
          continue;
        }

        // 1. Create or get subject
        let subjectId = createdSubjects.get(subjectName);
        if (!subjectId) {
          // Check if subject already exists
          const { data: existingSubject } = await supabase
            .from("subjects")
            .select("id")
            .eq("name", subjectName)
            .eq("school_id", schoolId)
            .maybeSingle();

          if (existingSubject?.id) {
            subjectId = existingSubject.id as string;
            createdSubjects.set(subjectName, subjectId);
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
              errors.push({ 
                row: rowNum, 
                error: `Failed to create subject "${subjectName}": ${subjectError.message}` 
              });
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
          // Check if class already exists
          const { data: existingClass } = await supabase
            .from("classes")
            .select("id")
            .eq("name", className)
            .eq("subject_id", subjectId)
            .maybeSingle();

          if (existingClass?.id) {
            classId = existingClass.id as string;
            createdClasses.set(classKey, classId);
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
              errors.push({ 
                row: rowNum, 
                error: `Failed to create class "${className}": ${classError.message}` 
              });
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
        // Check if class period already exists
        const { data: existingPeriod } = await supabase
          .from("class_periods")
          .select("id")
          .eq("class_id", classId)
          .eq("period", period)
          .maybeSingle();

        let classPeriodId: string;
        if (existingPeriod) {
          classPeriodId = existingPeriod.id as string;
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
            errors.push({ 
              row: rowNum, 
              error: `Failed to create class period "${period}": ${periodError.message}` 
            });
            stats.errors.push(
              `Row ${rowNum}: Failed to create class period "${period}": ${periodError.message}`
            );
            continue;
          }

          classPeriodId = newPeriod.id as string;
          stats.classPeriodsCreated++;
        }

        // Mark this period as processed
        processedPeriods.add(periodKey);

        // 4. Assign teacher if provided
        if (teacherEmail) {
          // Find teacher by email
          const { data: teacher } = await supabase
            .from("user_profiles")
            .select("id")
            .eq("email", teacherEmail.toLowerCase())
            .eq("role", "teacher")
            .eq("school_id", schoolId)
            .maybeSingle();

          if (teacher) {
            // Check if teacher is already assigned to this class period
            const { data: existingAssignment } = await supabase
              .from("class_teacher_assignments")
              .select("id")
              .eq("class_period_id", classPeriodId)
              .eq("teacher_id", teacher.id)
              .maybeSingle();

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

        // Track successful processing
        successful.push({
          row: rowNum,
          data: {
            subject: subjectName,
            class: className,
            period: period,
            teacher: teacherEmail,
          },
        });
      } catch (error) {
        console.error(`Error processing row ${rowNum}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.push({ row: rowNum, error: errorMessage });
        stats.errors.push(`Row ${rowNum}: Unexpected error - ${errorMessage}`);
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