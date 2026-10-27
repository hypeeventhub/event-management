import {
  ChevronDown,
  LogOut,
  Menu,
  Network,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


export function TopHeader({ onMenuOpen, onLogout, user }) {
  return (
    <header className="fixed top-0 right-0 left-0 z-40 h-16 border-b border-[#ffdece]/60 bg-[#fffaf7]/85 backdrop-blur-xl xl:left-72">
      <div className="flex h-16 w-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onMenuOpen}
            className="shrink-0 xl:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>

          <div className="flex items-center gap-2 sm:hidden">
            {/* <span className="flex size-8 items-center justify-center rounded-lg bg-[#f6671e] text-white">
              <Network className="size-4.5" />
            </span> */}
            <span className="font-bold tracking-tight text-[#25170f]">Hype Event Hub</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="-m-1 flex items-center gap-2 rounded-xl p-1 text-left transition-colors outline-none hover:bg-[#fff4ee] focus-visible:ring-2 focus-visible:ring-[#f6671e]/30 sm:pl-3"
                aria-label={`Open menu for ${user?.name || "user"}`}
              >
                <div className="hidden text-right md:block">
                  <div className="text-sm leading-4 font-semibold text-[#25170f]">
                    {user?.name || "Event User"}
                  </div>
                  <div className="text-[11px] leading-3.5 capitalize text-[#6f625b]">
                    {user?.role || "User"}
                  </div>
                </div>
                <div className="flex size-8 items-center justify-center rounded-full bg-[#f6671e] text-white">
                  <UserRound className="size-4.5" />
                </div>
                <ChevronDown className="hidden size-3.5 text-[#96877f] sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings />
                  Settings
                </Link>
              </DropdownMenuItem>
              {user?.role === "Admin" && (
                <DropdownMenuItem asChild>
                  <Link href="/manage-users">
                    <Users />
                    Manage Users
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={onLogout}
                className="text-[#ba1a1a] focus:bg-[#fff0f0] focus:text-[#ba1a1a]"
              >
                <LogOut />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
