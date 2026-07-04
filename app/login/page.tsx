import { AuthScreen } from "@/components/AuthScreen"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  return <AuthScreen initialError={params.error} />
}
