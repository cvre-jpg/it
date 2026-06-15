import { createServerFn } from "@tanstack/react-start";

export type AnalyticsEventType = "page_view" | "inquiry_submitted";

export type AnalyticsEventInput = {
  event_type: AnalyticsEventType;
  pathname: string;
  session_id?: string | null;
  source?: string | null;
  referrer?: string | null;
  device_type?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function ensureAnalyticsTables() {
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  await sql`
    create table if not exists analytics_events (
      id bigserial primary key,
      event_type text not null,
      pathname text not null,
      session_id text null,
      source text not null default 'Direct',
      referrer text null,
      device_type text not null default 'Unknown',
      user_agent text null,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `;

  await sql`create index if not exists analytics_events_event_type_idx on analytics_events (event_type)`;
  await sql`create index if not exists analytics_events_created_at_idx on analytics_events (created_at desc)`;
  await sql`create index if not exists analytics_events_source_idx on analytics_events (source)`;
  await sql`create index if not exists analytics_events_device_type_idx on analytics_events (device_type)`;
}

const trackAnalyticsEventServer = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const input = data as AnalyticsEventInput;
  const { getNeonSql } = await import("./neon.server");
  const sql = getNeonSql();

  await ensureAnalyticsTables();

  await sql`
    insert into analytics_events (
      event_type,
      pathname,
      session_id,
      source,
      referrer,
      device_type,
      user_agent,
      metadata
    )
    values (
      ${input.event_type},
      ${input.pathname},
      ${input.session_id ?? null},
      ${input.source ?? "Direct"},
      ${input.referrer ?? null},
      ${input.device_type ?? "Unknown"},
      ${input.user_agent ?? null},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
  `;

  return { ok: true };
});

export async function trackAnalyticsEvent(input: AnalyticsEventInput) {
  return trackAnalyticsEventServer({ data: input }) as Promise<{ ok: true }>;
}
