# Supabase Integration Setup Guide

## Overview

The QR Generator App now supports loading member data from Supabase database with automatic fallback to local Excel file (EMS_Data.xlsx).

**Data Loading Priority:**
1. **Supabase API** (if configured)
2. **Local Excel file** (fallback)

## Supabase Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and anon/public key from Settings → API

### 2. Create Database Table

Run this SQL in the Supabase SQL Editor:

```sql
CREATE TABLE members (
    id BIGSERIAL PRIMARY KEY,
    id_number TEXT NOT NULL,
    name TEXT NOT NULL,
    contact_number TEXT NOT NULL,
    ice_contact_name TEXT NOT NULL,
    ice_contact_surname TEXT,
    ice_contact_number TEXT NOT NULL,
    medical_aid_name TEXT,
    medical_aid_number TEXT,
    medical_aid_plan TEXT,
    allergies TEXT,
    medical_conditions TEXT,
    starting_date DATE,
    membership_number TEXT,
    position TEXT,
    rank TEXT,
    vehicle_make TEXT,
    vehicle_model TEXT,
    vehicle_registration TEXT,
    country TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX idx_members_id_number ON members(id_number);
CREATE INDEX idx_members_name ON members(name);

-- Enable Row Level Security (RLS)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access (adjust as needed)
CREATE POLICY "Allow public read access" ON members
    FOR SELECT
    USING (true);
```

### 3. Configure in the App

1. Open the QR Generator App
2. Click the **⚙️ Settings** button
3. Scroll to **Supabase Configuration** section
4. Enter:
   - **Supabase URL**: `https://your-project.supabase.co`
   - **Supabase Anon Key**: Your public/anon key from Supabase dashboard
   - **Table Name**: `members` (or your custom table name)
5. Click **Save Configuration**
6. Click **Test Connection** to verify

### 4. Import Data

You can import your existing Excel data to Supabase:

**Option A: Using Supabase Dashboard**
1. Go to Table Editor in Supabase
2. Click "Insert" → "Import from CSV"
3. Export your Excel to CSV first, then import

**Option B: Using SQL**
```sql
INSERT INTO members (
    id_number, name, contact_number, 
    ice_contact_name, ice_contact_number,
    medical_aid_name, medical_aid_number, medical_aid_plan,
    allergies, medical_conditions,
    starting_date, membership_number, position, rank,
    vehicle_make, vehicle_model, vehicle_registration, country
) VALUES
    ('123456789', 'John Smith', '0821234567', 
     'Mary Smith', '0827654321',
     'Discovery', '12345', 'Executive Plan',
     'None', 'None',
     '2025-01-01', 'MEM001', 'Chaplain', 'Captain',
     'Toyota', 'Corolla', 'ABC123GP', 'South Africa');
```

## Column Name Mapping

The app automatically maps between different naming conventions:

| App Field | Supabase (snake_case) | Excel Column |
|-----------|----------------------|--------------|
| idNumber | id_number | ID Number |
| name | name | Name |
| contactNumber | contact_number | Contact Number |
| iceContactName | ice_contact_name | ICEName |
| iceContactSurname | ice_contact_surname | ICESurname |
| iceContactNumber | ice_contact_number | ICEContact Number |
| medicalAidName | medical_aid_name | Medical Aid Name |
| medicalAidNumber | medical_aid_number | Medical Aid Number |
| medicalAidPlan | medical_aid_plan | Medical Aid Plan |
| allergies | allergies | Allergies |
| medicalConditions | medical_conditions | Medical Conditions |
| startingDate | starting_date | Starting Date |
| membershipNumber | membership_number | Membership Number |
| position | position | Position |
| rank | rank | Rank |
| vehicleMake | vehicle_make | Vehicle Make |
| vehicleModel | vehicle_model | Model |
| vehicleRegistration | vehicle_registration | Registration Number |
| country | country | Country |

## Data Validation

The app validates that each record has these **required fields**:
- ID Number
- Name
- Contact Number
- ICE Contact Name
- ICE Contact Number

Records missing required fields will be logged as warnings but processing will continue with valid records.

## Security Considerations

### Row Level Security (RLS)

The example above uses a simple policy allowing public read access. For production:

```sql
-- Only allow authenticated users to read
CREATE POLICY "Authenticated users can read" ON members
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Only admins can insert/update
CREATE POLICY "Admins can modify" ON members
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');
```

### API Key Security

- The **anon/public key** is stored in browser localStorage
- For production, consider:
  - Using authenticated users with proper RLS policies
  - Implementing API key rotation
  - Using environment-specific keys

## Testing

1. **Test Connection**: Use the "Test Connection" button in settings
2. **Check Console**: Open browser DevTools (F12) to see detailed logs
3. **Verify Data Source**: After loading, check which source was used (shown in Bulk Mode section)

## Troubleshooting

### "Connection failed" Error
- Verify URL and key are correct
- Check Supabase project is running
- Ensure RLS policies allow SELECT
- Check browser console for detailed errors

### Data Not Loading
- Verify table name matches configuration
- Check if table has data
- Ensure column names match (snake_case in Supabase)
- Check browser console for validation errors

### Falls Back to Excel
- This is normal if Supabase is not configured
- Check if Supabase URL/key are saved in settings
- Click "Test Connection" to diagnose issues

## Benefits of Supabase

✅ **Real-time updates**: Data changes instantly available  
✅ **Multi-user**: Multiple people can manage data  
✅ **Cloud backup**: Data stored securely in cloud  
✅ **Easy updates**: Update members without editing Excel files  
✅ **Validation**: Automatic data validation and requirements checking  
✅ **Scalable**: Handles large datasets better than Excel  

## Fallback to Excel

The app will automatically use the local `EMS_Data.xlsx` file if:
- Supabase is not configured
- Connection fails
- No data found in Supabase
- Any error occurs

This ensures the app always works, even without internet or Supabase setup.
