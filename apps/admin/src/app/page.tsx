export default function HomePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-8">
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-8 shadow-sm">
        <div className="mb-2 text-sm font-medium text-primary">TempleOS</div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Portal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Phase 0 skeleton. Auth, onboarding, and the dashboard shell land next.
        </p>
      </div>
    </main>
  );
}
