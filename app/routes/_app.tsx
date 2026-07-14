import { isRouteErrorResponse, Outlet, useLocation, useRouteError } from "react-router";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import type { Route } from "./+types/_app";
import { getCapabilities, getChains } from "~/lib/api";
import { requireKey } from "~/lib/auth";
import { AppSidebar } from "~/components/app-sidebar";
import { useTheme } from "~/components/theme-provider";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar";
import { Skeleton } from "~/components/ui/skeleton";

import type { Capabilities, ChainInfo } from "~/lib/api-types";

let serverConfig: Promise<[ChainInfo[], Capabilities]> | null = null;

export async function clientLoader() {
  requireKey();
  serverConfig ??= Promise.all([getChains(), getCapabilities()]);
  try {
    const [chains, capabilities] = await serverConfig;
    return { chains, capabilities };
  } catch (error) {
    serverConfig = null; // don't cache a failure
    throw error;
  }
}

export function shouldRevalidate() {
  return false;
}

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/activity": "Activity",
  "/channels": "Channels",
  "/settings": "Settings",
};

function ThemeToggle() {
  const { setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Change theme" />}
      >
        <SunIcon className="dark:hidden" />
        <MoonIcon className="hidden dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <SunIcon /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <MoonIcon /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <MonitorIcon /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] ?? "Cointer";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <h1 className="text-sm font-medium">{title}</h1>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function AppLayout() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

export function HydrateFallback() {
  return (
    <div className="flex min-h-svh">
      <div className="hidden w-64 shrink-0 border-r bg-sidebar p-4 md:block">
        <Skeleton className="mb-6 h-6 w-28" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
      <div className="flex-1 p-6">
        <Skeleton className="mb-6 h-6 w-40" />
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? error.statusText || `Error ${error.status}`
    : error instanceof Error
      ? error.message
      : "Something went wrong.";

  return (
    <Shell>
      <div className="mx-auto mt-16 max-w-md text-center">
        <h2 className="text-sm font-medium">Couldn't load this page</h2>
        <p className="mt-1 text-xs/relaxed text-muted-foreground">{message}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Try again
        </Button>
      </div>
    </Shell>
  );
}
