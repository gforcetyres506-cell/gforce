import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const email = process.argv[2] || 'gforcetyres506@gmail.com';
const password = process.argv[3] || 'GForce2026!Admin';
const name = process.argv[4] || 'G Force Owner';

const supabase = createClient(supabaseUrl, serviceKey);

async function createAdmin() {
  console.log(`🔐 Creating Admin User: ${email}`);

  // 1. Check if user already exists
  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw listErr;

  let user = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (createErr) throw createErr;
    user = createData.user;
    console.log('✅ Supabase Auth user created:', user.id);
  } else {
    console.log('ℹ️ Supabase Auth user already exists:', user.id);
    // Update password
    await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    console.log('🔑 Password updated for existing user.');
  }

  // 2. Link to admin_profiles
  const { data: existingProfile } = await supabase
    .from('admin_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existingProfile) {
    const { error: pErr } = await supabase.from('admin_profiles').insert({
      user_id: user.id,
      name,
      role: 'owner',
      active: true,
    });
    if (pErr) throw pErr;
    console.log('✅ Admin profile created with role "owner"!');
  } else {
    const { error: pErr } = await supabase
      .from('admin_profiles')
      .update({ role: 'owner', active: true, name })
      .eq('user_id', user.id);
    if (pErr) throw pErr;
    console.log('✅ Admin profile updated and activated with role "owner"!');
  }

  console.log('\n─────────────────────────────────────────');
  console.log('🎉 Admin login credentials ready:');
  console.log('   URL:      http://localhost:3000/admin/login');
  console.log('   Email:    ' + email);
  console.log('   Password: ' + password);
  console.log('─────────────────────────────────────────\n');
}

createAdmin().catch((err) => {
  console.error('❌ Failed to create admin:', err);
  process.exit(1);
});
