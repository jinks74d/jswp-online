/**
 * Layout for the unauthenticated auth pages: /login, /signup, /reset-password.
 *
 * Centers the auth card on a white background. The logo is inside each page
 * (not here) so individual pages can vary copy underneath it.
 */

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">{children}</div>
    </main>
  );
}
