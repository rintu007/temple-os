/** Renders a schema.org JSON-LD block. Search engines/link-unfurlers parse this even on noindex pages. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Static JSON.stringify of our own typed data — no user HTML ever reaches this.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
