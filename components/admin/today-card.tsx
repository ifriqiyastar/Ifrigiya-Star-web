"use client";

import Link from "next/link";
import {
  CalendarDaysIcon,
  ChevronRightIcon,
  FlagIcon,
  MapPinIcon,
  ShieldCheckIcon,
} from "lucide-react";

import type { AdminTask, NextAdminEvent } from "@/lib/queries/admin-queue";
import { makeFormat } from "@/lib/format";
import { fill } from "@/lib/i18n/admin-shared";
import { useAdminI18n } from "@/lib/i18n/admin-client";
import { localePath } from "@/lib/i18n/config";

export function TodayCard({
  tasks,
  nextEvent,
}: {
  tasks: AdminTask[];
  nextEvent: NextAdminEvent | null;
}) {
  const { locale, dict } = useAdminI18n();
  const { formatShortDay } = makeFormat(locale);
  // Regroupement par **cle** et non par libelle : le libelle est traduit.
  const validations = tasks
    .filter((task) => task.group === "validations")
    .reduce((sum, task) => sum + task.count, 0);
  const reports = tasks
    .filter((task) => task.group === "moderation")
    .reduce((sum, task) => sum + task.count, 0);
  const total = tasks.reduce((sum, task) => sum + task.count, 0);
  const href = localePath(locale, tasks[0]?.href ?? "/admin");

  return (
    <section
      className="mx-1 overflow-hidden rounded-lg border border-sidebar-border bg-[#191c20]"
      aria-labelledby="today-card-title"
    >
      <div className="flex items-center justify-between border-b border-sidebar-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-brand shadow-[0_0_8px_rgba(158,233,57,0.65)]" />
          <h2 id="today-card-title" className="micro-label text-sidebar-foreground">
            {dict.today.title}
          </h2>
        </div>
        <span className="micro-label text-muted-foreground">
          {total ? fill(dict.today.pending, { count: total }) : dict.today.clear}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-sidebar-border">
        <QueueMetric
          icon={ShieldCheckIcon}
          label={dict.today.validations}
          value={validations}
          urgent={validations > 0}
        />
        <QueueMetric
          icon={FlagIcon}
          label={dict.today.reports}
          value={reports}
          urgent={reports > 0}
        />
      </div>

      <div className="p-3">
        <div className="flex items-start gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand/12 text-brand">
            <CalendarDaysIcon className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="micro-label text-muted-foreground">{dict.today.nextEvent}</p>
            {nextEvent ? (
              <>
                <Link
                  href={localePath(locale, `/admin/scout-days/${nextEvent.id}`)}
                  className="mt-1 block truncate text-[0.6875rem] font-semibold text-sidebar-foreground transition-colors hover:text-brand"
                >
                  {nextEvent.title}
                </Link>
                <p className="mt-1 flex min-w-0 items-center gap-1 text-[0.5625rem] text-muted-foreground">
                  <span className="shrink-0 text-brand">
                    {formatShortDay(`${nextEvent.event_date}T12:00:00Z`)}
                  </span>
                  {nextEvent.start_time ? (
                    <span className="shrink-0">· {nextEvent.start_time.slice(0, 5)}</span>
                  ) : null}
                  {nextEvent.location ? (
                    <>
                      <MapPinIcon className="ml-0.5 size-2.5 shrink-0" />
                      <span className="truncate">{nextEvent.location}</span>
                    </>
                  ) : null}
                </p>
              </>
            ) : (
              <p className="mt-1 text-[0.625rem] leading-relaxed text-muted-foreground">
                {dict.today.noEvent}
              </p>
            )}
          </div>
        </div>
      </div>

      <Link
        href={href}
        className="flex items-center justify-between border-t border-sidebar-border bg-secondary/35 px-3 py-2.5 text-[0.6875rem] font-semibold text-sidebar-foreground transition-colors hover:bg-secondary hover:text-brand"
      >
        <span>{total ? dict.today.seeTasks : dict.today.openDashboard}</span>
        <ChevronRightIcon className="size-3.5" />
      </Link>
    </section>
  );
}

function QueueMetric({
  icon: Icon,
  label,
  value,
  urgent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  urgent: boolean;
}) {
  return (
    <div className="bg-[#191c20] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <Icon className={urgent ? "size-3.5 text-brand" : "size-3.5 text-muted-foreground"} />
        <span
          className={
            urgent
              ? "font-heading text-base font-extrabold text-brand tabular-nums"
              : "font-heading text-base font-extrabold text-muted-foreground tabular-nums"
          }
        >
          {value}
        </span>
      </div>
      <p className="mt-1 truncate text-[0.5625rem] text-muted-foreground">{label}</p>
    </div>
  );
}
