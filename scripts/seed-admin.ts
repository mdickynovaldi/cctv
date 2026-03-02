/**
 * Seed Admin User Script
 * 
 * Creates the first admin user via Supabase Auth Admin API.
 * Run with: bunx tsx scripts/seed-admin.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables. Make sure .env.local is loaded.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ===== SEED USERS =====
const seedUsers = [
  {
    email: 'admin@vms.com',
    password: 'admin123',
    full_name: 'Admin VMS',
    role: 'admin',
    department: 'IT',
    phone: '081234567890',
  },
  {
    email: 'resepsionis@vms.com',
    password: 'resepsionis123',
    full_name: 'Resepsionis VMS',
    role: 'receptionist',
    department: 'Front Office',
    phone: '081234567891',
  },
  {
    email: 'host@vms.com',
    password: 'host123',
    full_name: 'Host / PIC',
    role: 'host',
    department: 'Engineering',
    phone: '081234567892',
  },
]

async function seed() {
  console.log('🌱 Seeding users...\n')

  for (const user of seedUsers) {
    console.log(`  Creating ${user.role}: ${user.email}...`)

    // Create auth user
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        full_name: user.full_name,
        role: user.role,
      },
    })

    if (error) {
      if (error.message?.includes('already been registered')) {
        console.log(`  ⚠️  ${user.email} sudah ada, skip.\n`)
      } else {
        console.error(`  ❌ Error: ${error.message}\n`)
      }
      continue
    }

    // Update profile with phone & department
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          phone: user.phone,
          department: user.department,
        })
        .eq('id', data.user.id)

      if (profileError) {
        console.log(`  ⚠️  Profile update failed: ${profileError.message}`)
      }
    }

    console.log(`  ✅ ${user.full_name} (${user.role}) created!\n`)
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎉 Seed complete! Login credentials:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  for (const user of seedUsers) {
    console.log(`  ${user.role.toUpperCase().padEnd(14)} ${user.email.padEnd(25)} / ${user.password}`)
  }
  console.log('')
}

seed().catch(console.error)
