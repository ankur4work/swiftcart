import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStore } from '@/lib/shopify/auth-guard';
import { prisma } from '@/lib/prisma';
import { CartOpenSelectorSchema, HexColorSchema } from '@/lib/shopify/validators';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SettingsSchema = z.object({
  design: z.enum(['BAR', 'BUTTON']),
  buttonPosition: z.enum(['BOTTOM_RIGHT', 'BOTTOM_LEFT', 'MIDDLE_RIGHT', 'MIDDLE_LEFT']),
  showOnDesktop: z.boolean(),
  showOnMobile: z.boolean(),
  hideWhenEmpty: z.boolean(),
  backgroundColor: HexColorSchema,
  textColor: HexColorSchema,
  accentColor: HexColorSchema,
  cornerRadius: z.number().int().min(0).max(40),
  showItemCount: z.boolean(),
  showSubtotal: z.boolean(),
  ctaLabel: z.string().trim().min(1).max(30),
  cartOpenSelector: CartOpenSelectorSchema,
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireStore(req);
  if (ctx instanceof NextResponse) return ctx;

  const settings = await prisma.cartBarSettings.upsert({
    where: { storeId: ctx.store.id },
    create: { storeId: ctx.store.id },
    update: {},
  });

  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireStore(req);
  if (ctx instanceof NextResponse) return ctx;

  // The paywall is enforced on writes, not reads. A lapsed merchant can still
  // see what their configuration was — losing sight of it would make deciding
  // whether to resubscribe harder, and there is nothing to protect: the
  // storefront already renders nothing for them.
  if (ctx.store.entitlement !== 'ACTIVE') {
    return NextResponse.json(
      { error: 'subscription required', action: 'subscribe' },
      { status: 402 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const parsed = SettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid settings', issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })) },
      { status: 400 },
    );
  }

  const settings = await prisma.cartBarSettings.upsert({
    where: { storeId: ctx.store.id },
    create: { storeId: ctx.store.id, ...parsed.data },
    update: parsed.data,
  });

  logger.info({ shop: ctx.shopDomain }, 'Cart bar settings updated');
  return NextResponse.json({ settings });
}
