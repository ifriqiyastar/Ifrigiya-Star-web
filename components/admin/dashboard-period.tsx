"use client";



import { useRouter } from "next/navigation";

import { NativeSelect } from "@/components/ui/native-select";
import { useAdminI18n } from "@/lib/i18n/admin-client";
import { localePath } from "@/lib/i18n/config";

export function DashboardPeriod({ value }: { value: number }) {
  const router = useRouter();
  const { locale, dict } = useAdminI18n();
  const d = dict.dashboard;
  return (
    <NativeSelect
      aria-label={d.periodLabel}
      value={String(value)}
      onChange={(event) =>
        router.push(localePath(locale, `/admin?periode=${event.target.value}`))
      }
      className="h-9 min-w-40 rounded-md border border-border bg-card px-3 text-xs"
    >
      <option value="7">{d.period7}</option>
      <option value="30">{d.period30}</option>
      <option value="90">{d.period90}</option>
      <option value="365">{d.period365}</option>
    </NativeSelect>
  );
}
