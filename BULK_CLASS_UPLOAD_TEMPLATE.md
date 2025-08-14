# Bulk Class Upload Template

## 📋 **Required Spreadsheet Columns**

### **For CSV/Excel Upload:**

| Column Name           | Required | Description                    | Example Values                                      |
| --------------------- | -------- | ------------------------------ | --------------------------------------------------- |
| `subject_name`        | ✅       | Subject/Course name            | "Mathematics", "English Language Arts", "Biology"   |
| `class_name`          | ✅       | Class name                     | "Algebra I", "English 9A", "AP Biology"             |
| `period`              | ✅       | Class period/time              | "1st Period", "Period A", "Block 1", "8:00-9:00 AM" |
| `teacher_email`       | ❌       | Teacher's email (optional)     | "john.smith@school.edu"                             |
| `subject_description` | ❌       | Subject description (optional) | "Advanced mathematics course"                       |

### **Sample CSV Content:**

```csv
subject_name,class_name,period,teacher_email,subject_description
Mathematics,Algebra I,1st Period,john.smith@school.edu,Introduction to algebraic concepts
Mathematics,Geometry,2nd Period,jane.doe@school.edu,Plane and solid geometry
English Language Arts,English 9A,3rd Period,mary.johnson@school.edu,Freshman English literature and composition
Science,Biology,4th Period,robert.wilson@school.edu,General biology for high school students
History,World History,5th Period,sarah.brown@school.edu,Survey of world civilizations
```

## 🔄 **How the Upload Process Works:**

### **1. Data Processing:**

- **Subject Creation**: If subject doesn't exist, creates it automatically
- **Class Creation**: Creates class linked to subject
- **Class Period Creation**: Creates specific period for the class
- **Teacher Assignment**: If teacher email provided, assigns teacher to class period

### **2. Validation Rules:**

- **Duplicate Prevention**: Won't create duplicate subjects or classes
- **Email Validation**: Checks if teacher email exists in system
- **Period Uniqueness**: Ensures no duplicate periods for same class
- **School Scope**: All data scoped to school admin's school

### **3. Error Handling:**

- **Invalid Data**: Skips rows with missing required fields
- **Teacher Not Found**: Creates class but logs warning about teacher
- **Duplicate Classes**: Updates existing instead of creating duplicate

## 📝 **Alternative Formats Supported:**

### **Google Sheets:**

- Share sheet with read access
- Provide Google Sheets URL
- System will read and process automatically

### **Excel (.xlsx):**

- Upload .xlsx file directly
- Supports multiple sheets (uses first sheet)
- Preserves formatting and data types

### **CSV (.csv):**

- Standard comma-separated values
- UTF-8 encoding recommended
- Headers must match exactly

## ⚠️ **Important Notes:**

### **Data Requirements:**

- **Subject names** will be created if they don't exist
- **Teacher emails** must exist in the system (optional field)
- **Periods** can be any format (1st Period, Block A, 8:00-9:00, etc.)
- **Class names** should be unique within each subject

### **Best Practices:**

- **Test with small batch** first (5-10 rows)
- **Use consistent naming** for subjects and periods
- **Include teacher emails** for automatic assignment
- **Review data** before upload for accuracy

## 🎯 **Expected Results:**

After successful upload:

- ✅ **Subjects created** (if new)
- ✅ **Classes created** with proper subject links
- ✅ **Class periods created** with unique periods
- ✅ **Teachers assigned** (if emails provided and valid)
- ✅ **All data scoped** to your school
- ✅ **Duplicate prevention** built-in

## 📊 **Upload Statistics:**

The system will provide:

- **Total rows processed**
- **Subjects created/updated**
- **Classes created**
- **Class periods created**
- **Teachers assigned**
- **Errors/warnings** with details
