import { createClient } from '@/lib/supabase/server'
import StatusBoard from '@/components/StatusBoard'

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <StatusBoard currentUser={user?.email || ''} />
}
