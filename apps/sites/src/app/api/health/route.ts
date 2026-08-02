import { NextResponse } from 'next/server';
import { createHealthService } from '@templeos/core';
import { getDb } from '@templeos/db';

/** Pinged by apps/admin's health-check cron — no auth, touches no tenant data. */
export async function GET() {
  const result = await createHealthService({ db: getDb() }).checkDb();
  return NextResponse.json(
    { status: result.currentStatus },
    { status: result.currentStatus === 'up' ? 200 : 503 },
  );
}
