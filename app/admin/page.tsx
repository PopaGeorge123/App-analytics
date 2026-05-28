import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminTabs from "./_components/AdminTabs";

const ADMIN_USER_ID = 'bfd5f621-a8f0-4530-ae27-aabbe54491e0';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.id !== ADMIN_USER_ID) {
    redirect('/dashboard');
  }

  return (
    <main className="min-h-screen bg-[#f5f5f8] p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1a1a2e] font-mono">Admin Dashboard</h1>
          <p className="text-sm text-[#6a6a90] font-mono mt-2">Welcome back, {user.email}</p>
        </div>
        
        <AdminTabs />
      </div>
    </main>
  );
}
