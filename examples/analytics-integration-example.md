# Analytics Integration Examples

This document shows how to integrate analytics tracking into your JSWP Online components.

## 1. Basic Setup

The analytics system is automatically enabled in the dashboard layout. No additional setup is required for basic session tracking.

## 2. Tracking User Actions in Components

### Example: Tracking Assignment Form Actions

```typescript
// In any dashboard component
import { useSessionTrackingContext } from '@/components/analytics/SessionTrackingProvider';

export default function AssignmentForm({ assignmentId }: { assignmentId: string }) {
  const { trackAction } = useSessionTrackingContext();

  const handleSave = async (formData: any) => {
    // Track the save action
    await trackAction('assignment_save', {
      formType: 'literary_assignment',
      fieldsCompleted: Object.keys(formData).length,
      timeSpent: Date.now() - startTime
    }, assignmentId);

    // Your existing save logic
    await saveAssignment(formData);
  };

  const handleSubmit = async () => {
    // Track submission
    await trackAction('assignment_submit', {
      formType: 'literary_assignment',
      finalSubmission: true
    }, assignmentId);

    // Your existing submit logic
    await submitAssignment();
  };

  // Track when user starts working
  useEffect(() => {
    trackAction('assignment_start', {
      formType: 'literary_assignment'
    }, assignmentId);
  }, []);

  return (
    // Your component JSX
  );
}
```

### Example: Tracking Student Progress

```typescript
// In student assignment forms
const handleProgressUpdate = async (step: string, data: any) => {
  // Track progress milestone
  await trackAction('progress_milestone', {
    step: step,
    completionPercentage: calculateCompletion(data),
    writingStyle: 'narrative'
  }, assignmentId);

  // Update progress
  await updateStudentProgress(step, data);
};
```

## 3. Custom Action Types

The system supports any action type strings. Recommended conventions:

- `assignment_create` - When teacher creates assignment
- `assignment_save` - Auto-save or manual save
- `assignment_submit` - Final submission by student
- `progress_milestone` - Student reaches a step milestone
- `feedback_given` - Teacher provides feedback
- `grade_assigned` - Teacher grades assignment
- `file_upload` - File attachment
- `print_assignment` - Assignment printed
- `form_validation_error` - Form validation failures

## 4. Analytics Dashboard Access

### For District Admins
- Navigate to `/dashboard/analytics`
- View district-wide or school-specific data
- Filter by time ranges (1d, 7d, 30d, 90d)

### For School Admins
- Navigate to `/dashboard/analytics`
- View school-specific data only
- Same filtering options

### For Super Admins
- Navigate to `/super-admin/analytics`
- View system-wide data
- Can filter by district or school

## 5. API Endpoints

### Session Management
- `POST /api/analytics/session/start` - Start new session
- `POST /api/analytics/session/activity` - Update activity
- `POST /api/analytics/session/end` - End session

### Analytics Data
- `GET /api/analytics/dashboard` - Get analytics data
  - Query params: `range`, `level`, `district_id`, `school_id`

## 6. Database Schema

The analytics system creates these tables:
- `user_sessions` - Session tracking
- `user_page_views` - Page view details  
- `user_actions` - Specific user actions
- `daily_usage_analytics` - Materialized view for performance

## 7. Privacy & Security

- All analytics data respects RLS policies
- Users can only see their own session data
- Admins see data for their scope (district/school)
- No personal content is logged, only metadata
- IP addresses are stored but not displayed in UI

## 8. Performance Considerations

- Session updates are debounced (30 second intervals)
- Auto-save tracking doesn't spam the API
- Materialized views for historical data
- Indexes optimized for analytics queries
- Failed API calls fail silently to not break UX

## 9. Troubleshooting

### Session Not Starting
- Check if user is authenticated
- Verify AuthProvider is working
- Check browser console for errors

### Missing Analytics Data
- Ensure database schema is created
- Check RLS policies are active
- Verify user has admin permissions

### Performance Issues
- Run `REFRESH MATERIALIZED VIEW daily_usage_analytics;`
- Check database indexes are created
- Monitor API response times