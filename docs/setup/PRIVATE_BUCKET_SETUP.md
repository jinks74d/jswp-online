# Private Storage Bucket Setup

## Step 1: Create Private Bucket in Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Navigate to your project
3. Click **"Storage"** in the left sidebar
4. Click **"Create a new bucket"**

### Bucket Configuration:
- **Bucket name**: `district-logos`
- **Public bucket**: ❌ **NO** (keep it private)
- **File size limit**: `5 MB`
- **Allowed MIME types**: 
  ```
  image/jpeg
  image/jpg
  image/png
  image/webp
  image/svg+xml
  ```

## Step 2: Set Simple Policies

Since it's private, you only need one policy for uploads:

1. Go to **Authentication > Policies**
2. Find **`storage.objects`** table
3. Add this policy:

**Policy: Super Admin Upload Only**
- **Policy name**: `Super admin upload district logos`
- **Allowed operation**: `INSERT, UPDATE, DELETE`
- **Target roles**: `authenticated`
- **USING/WITH CHECK expression**:
  ```sql
  bucket_id = 'district-logos' AND
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role = 'super_admin'
  )
  ```

## Benefits of Private Bucket:
- ✅ Easier to set up (no complex public policies)
- ✅ Full control over who can access logos
- ✅ Can add authentication, analytics, etc.
- ✅ Can resize/optimize images on-the-fly
- ✅ Better security (no direct public access)