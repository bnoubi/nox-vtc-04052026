import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getUserDetail } from '@/app/admin/actions'
import { UserDetailClient } from './_components/user-detail-client'

interface Props {
  params: Promise<{ id: string }>
}

export default async function UserDetailPage({ params }: Props) {
  const { id } = await params
  const user = await getUserDetail(id)
  if (!user) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/users"
          className="flex items-center gap-1.5 text-sm"
          style={{ color: 'var(--admin-muted-foreground)' }}
        >
          <ArrowLeft size={16} />
          Retour aux utilisateurs
        </Link>
      </div>
      <UserDetailClient user={user} />
    </div>
  )
}
