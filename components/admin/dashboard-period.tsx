"use client";

import { useRouter } from "next/navigation";

import { NativeSelect } from "@/components/ui/native-select";

export function DashboardPeriod({ value }: { value: number }) {
  const router = useRouter();
  return (
    <NativeSelect
      aria-label="Periode du tableau de bord"
      value={String(value)}
      onChange={(event) => router.push(`/admin?periode=${event.target.value}`)}
      className="h-9 min-w-40 rounded-md border border-border bg-card px-3 text-xs"
    >
      <option value="7">7 derniers jours</option>
      <option value="30">30 derniers jours</option>
      <option value="90">90 derniers jours</option>
      <option value="365">12 derniers mois</option>
    </NativeSelect>
  );
}
