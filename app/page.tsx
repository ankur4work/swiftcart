import { AppShell } from './_components/AppShell';
import { env } from '@/lib/env';

// The embedded app is entirely session-token driven, so there is nothing here
// worth prerendering — and a static render would bake a build-time env value
// into the HTML.
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return <AppShell supportEmail={env.SUPPORT_EMAIL} />;
}
