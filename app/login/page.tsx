import { AuthScreenClient } from "./auth-screen-client"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  return <AuthScreenClient initialError={params.error} />
}
