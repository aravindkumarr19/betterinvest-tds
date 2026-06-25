import { createClient } from '@/lib/supabase/server'
import CriticalPHs from '@/components/CriticalPHs'

export default async function CriticalPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <CriticalPHs currentUser={user?.email || ''} />
}
