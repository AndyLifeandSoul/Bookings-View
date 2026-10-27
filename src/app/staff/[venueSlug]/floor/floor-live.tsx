"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AreaTabs, FloorCanvas, useAreaTabs, type LiveState, type PlanTable } from "@/components/floor-plan";

/** The live floor: area tabs over the plan, refreshed every minute while it's showing now. */
export function FloorLive({ tables, areas, live, following }: { tables: PlanTable[]; areas: { id: string; name: string }[]; live: Record<string, LiveState>; following: boolean }) {
  const router = useRouter();
  const { tabs, active, setActive } = useAreaTabs(tables, areas);
  useEffect(() => {
    if (!following) return;
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [following, router]);
  return (
    <div className="flex flex-col gap-3">
      <AreaTabs tabs={tabs} active={active} onChange={setActive} />
      <FloorCanvas tables={tables.filter((t) => t.areaId === active)} live={live} />
    </div>
  );
}
