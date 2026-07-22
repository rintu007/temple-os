import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContactForm } from '@/features/contact/components/contact-form';
import { resolveSite, websiteService } from '@/lib/services';

interface ContactPageProps {
  params: Promise<{ domain: string }>;
}

export async function generateMetadata({ params }: ContactPageProps): Promise<Metadata> {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) return { title: 'Site not found' };
  return {
    title: `Contact · ${site.name}`,
    robots: { index: false },
  };
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) notFound();

  const content = await websiteService().getPublicContent(site.organizationId);
  const hasDetails = Boolean(content.addressText || content.contactPhone || content.contactEmail);
  const socials = [
    { label: 'Facebook', url: content.facebookUrl },
    { label: 'Instagram', url: content.instagramUrl },
    { label: 'YouTube', url: content.youtubeUrl },
  ].filter((s): s is { label: string; url: string } => Boolean(s.url));

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="text-center">
        <div className="text-sm font-medium uppercase tracking-widest text-primary">Contact</div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{site.name}</h1>
      </header>

      <div className="mt-12 grid gap-10 md:grid-cols-[1fr_1.2fr]">
        <section className="space-y-6 text-sm">
          {hasDetails ? (
            <>
              {content.addressText ? (
                <div>
                  <h2 className="font-medium uppercase tracking-widest text-muted-foreground">
                    Address
                  </h2>
                  <p className="mt-2 whitespace-pre-line leading-relaxed">{content.addressText}</p>
                </div>
              ) : null}
              {content.contactPhone ? (
                <div>
                  <h2 className="font-medium uppercase tracking-widest text-muted-foreground">
                    Phone
                  </h2>
                  <p className="mt-2">
                    <a href={`tel:${content.contactPhone}`} className="hover:underline">
                      {content.contactPhone}
                    </a>
                  </p>
                </div>
              ) : null}
              {content.contactEmail ? (
                <div>
                  <h2 className="font-medium uppercase tracking-widest text-muted-foreground">
                    Email
                  </h2>
                  <p className="mt-2">
                    <a
                      href={`mailto:${content.contactEmail}`}
                      className="text-primary hover:underline"
                    >
                      {content.contactEmail}
                    </a>
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground">
              Send us a message using the form and we&apos;ll get back to you.
            </p>
          )}

          {socials.length > 0 ? (
            <div>
              <h2 className="font-medium uppercase tracking-widest text-muted-foreground">
                Follow us
              </h2>
              <ul className="mt-2 space-y-1">
                {socials.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-border bg-card shadow-card p-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Send a message
          </h2>
          <ContactForm organizationId={site.organizationId} organizationName={site.name} />
        </section>
      </div>
    </main>
  );
}
