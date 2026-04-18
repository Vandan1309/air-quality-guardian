import { Activity, Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  station: string;
  updatedAt: string;
}

export const DashboardHeader = ({ station, updatedAt }: DashboardHeaderProps) => {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-16 items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-card">
            <Activity className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-tight truncate sm:text-lg">
              AirWatch <span className="text-muted-foreground font-normal">Monitoring</span>
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {station} · Updated {updatedAt}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <div className="hidden md:flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-status-good opacity-60 animate-pulse-soft" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-status-good" />
            </span>
            <span className="text-muted-foreground">Live</span>
          </div>
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};
