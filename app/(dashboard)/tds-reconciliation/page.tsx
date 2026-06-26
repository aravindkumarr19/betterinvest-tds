import { createClient } from '@/lib/supabase/server'
import TdsReconciliation from '@/components/TdsReconciliation'

export default async function TdsReconciliationPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <TdsReconciliation currentUser={user?.email || ''} />
}
