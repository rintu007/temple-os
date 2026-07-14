export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Site not found</h1>
        <p className="mt-2 text-muted-foreground">
          There&apos;s no temple website at this address.
        </p>
        <p className="mt-6 text-xs text-muted-foreground">
          Powered by <span className="font-medium">TempleOS</span>
        </p>
      </div>
    </main>
  );
}
