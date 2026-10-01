"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  Clock3,
  LoaderCircle,
  PlusCircle,
  RadioTower,
  Search,
  UsersRound,
} from "lucide-react";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";

import LoginScreen from "@/components/auth/login-screen";
import { CreateEventDialog } from "@/components/dashboard/event-dialogs";
import { LiveEventCard, UpcomingEventCard } from "@/components/dashboard/event-cards";
import { InvitationDialog } from "@/components/dashboard/invitation-dialog";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopHeader } from "@/components/dashboard/top-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getApiErrorMessage,
  useAuth,
} from "@/functions/auth";
import { filterEvents, useEvents } from "@/functions/events";
import { getRoleHome } from "@/lib/role-routing.mjs";
import { cn } from "@/lib/utils";

function StatCard({ stat }) {
  const Icon = stat.icon;
  return (
    <Card className="flex min-h-32 items-center justify-between gap-3 p-4">
      <div className="space-y-1">
        <span className="text-[11px] leading-3.5 font-semibold tracking-[0.08em] text-[#6f625b] uppercase">
          {stat.label}
        </span>
        <div
          className={cn(
            "text-[32px] leading-[38px] font-bold",
            stat.accent ? "text-[#006c49]" : "text-[#25170f]",
          )}
        >
          {stat.value}
        </div>
        <span
          className={cn(
            "text-xs leading-4",
            stat.detailAccent || stat.accent
              ? "font-medium text-[#006c49]"
              : "text-[#6f625b]",
          )}
        >
          {stat.detail}
        </span>
      </div>
      <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", stat.iconClass)}>
        <Icon className="size-6" />
      </div>
    </Card>
  );
}

function EventDashboard({ onLogout, user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("ongoing");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [invitationEvent, setInvitationEvent] = useState(null);
  const [invitationMode, setInvitationMode] = useState("published");
  const [toast, setToast] = useState(null);
  const { events, error: eventsError, isLoading: eventsLoading, createEvent, updateEvent, updateRegistrationOpen } = useEvents();
  const [registrationBusySlug, setRegistrationBusySlug] = useState(null);
  const [registrationActionError, setRegistrationActionError] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const liveEvents = useMemo(() => events.filter((event) => event.isLive), [events]);
  const upcomingEvents = useMemo(() => events.filter((event) => !event.isLive), [events]);
  const visibleLiveEvents = useMemo(
    () => filterEvents(liveEvents, category, searchQuery),
    [category, liveEvents, searchQuery],
  );
  const visibleUpcomingEvents = useMemo(
    () => filterEvents(upcomingEvents, category, searchQuery),
    [category, searchQuery, upcomingEvents],
  );
  const stats = useMemo(() => [
    { label: "Total Events", value: events.length, detail: "Saved in the event database", icon: CalendarCheck2, iconClass: "bg-[#ffdece] text-[#f6671e]" },
    { label: "Ongoing / Live", value: liveEvents.length, detail: "Check-in active now", icon: RadioTower, iconClass: "bg-[#6cf8bb] text-[#00714d]", accent: true },
    { label: "Upcoming Events", value: upcomingEvents.length, detail: "Registration open", icon: Clock3, iconClass: "bg-[#ffdece] text-[#f6671e]" },
  ], [events.length, liveEvents.length, upcomingEvents.length]);

  function showToast(title, description) {
    setToast({ title, description });
  }

  async function handleRegistrationToggle(event) {
    setRegistrationBusySlug(event.sourceId);
    setRegistrationActionError("");

    try {
      await updateRegistrationOpen(event.sourceId, !event.registrationIsOpen);
      showToast(
        event.registrationIsOpen ? "Registration Closed" : "Registration Opened",
        `${event.title} registration is now ${event.registrationIsOpen ? "closed" : "open"}.`,
      );
    } catch (error) {
      setRegistrationActionError(getApiErrorMessage(error, "Registration availability could not be changed."));
    } finally {
      setRegistrationBusySlug(null);
    }
  }

  async function handleEventCreated(event) {
    const wasEditing = Boolean(editingEvent);
    const savedEvent = editingEvent
      ? await updateEvent(editingEvent.sourceId, event)
      : await createEvent(event);
    showToast(
      wasEditing ? "Event Updated Successfully" : "Event Created Successfully",
      `${savedEvent.title} is saved with its registration form.`,
    );

    if (!wasEditing) {
      window.setTimeout(() => {
        setInvitationMode("published");
        setInvitationEvent(savedEvent);
      }, 0);
    }
  }

  return (
    <div className="min-h-screen bg-[#fffaf7] text-[#25170f]">
      <Sidebar
        role={user.role}
        activeItem="Dashboard"
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <TopHeader
        onMenuOpen={() => setSidebarOpen(true)}
        onLogout={onLogout}
        user={user}
      />

      <div className="xl:pl-72">
        <main id="events" className="min-h-screen px-4 pt-[72px] pb-8 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
            <section className="flex flex-col justify-between gap-4 pt-0.5 md:flex-row md:items-center">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[28px] leading-9 font-bold tracking-tight text-[#25170f] sm:text-4xl sm:leading-11">
                    Dashboard
                  </h1>
                  <Badge variant="success">
                    <span className="size-2 animate-pulse rounded-full bg-[#006c49]" />{liveEvents.length} Active Now
                  </Badge>
                </div>
                <p className="max-w-2xl text-sm leading-5 text-[#6f625b]">
                  Manage events, registrations, attendee passes, and event activities.
                </p>
              </div>
              <Button
                type="button"
                size="lg"
                className="w-full md:w-auto"
                onClick={() => {
                  setEditingEvent(null);
                  setCreateOpen(true);
                }}
              >
                <PlusCircle className="size-5" />
                Create Event
              </Button>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Event portfolio summary">
              {stats.map((stat) => (
                <StatCard key={stat.label} stat={stat} />
              ))}
            </section>

            {registrationActionError && <div role="alert" className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm font-medium text-[#93000a]">{registrationActionError}</div>}

            <section className="flex flex-col justify-between gap-4 rounded-2xl bg-white p-2 shadow-[0_1px_3px_rgba(40,48,68,0.08)] min-[1400px]:flex-row min-[1400px]:items-center">
              <div className="grid grid-cols-1 gap-1 rounded-xl bg-[#fff4ee] p-1 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("ongoing")}
                  className={cn(
                    "flex min-h-9 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs leading-4 transition-all",
                    activeTab === "ongoing"
                      ? "bg-white font-semibold text-[#f6671e] shadow-sm"
                      : "font-medium text-[#6f625b] hover:text-[#25170f]",
                  )}
                >
                  <span className="size-2 animate-pulse rounded-full bg-[#006c49]" />
                  <span>Ongoing Events ({liveEvents.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("upcoming")}
                  className={cn(
                    "flex min-h-9 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs leading-4 transition-all",
                    activeTab === "upcoming"
                      ? "bg-white font-semibold text-[#f6671e] shadow-sm"
                      : "font-medium text-[#6f625b] hover:text-[#25170f]",
                  )}
                >
                  <span>Upcoming Events ({visibleUpcomingEvents.length})</span>
                </button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:min-w-60">
                  <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#6f625b]" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="h-9 pl-9 text-xs"
                    placeholder="Filter events by title or venue..."
                    aria-label="Filter events"
                  />
                </div>
              </div>
            </section>

            {eventsError && (
              <div role="alert" className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm font-medium text-[#93000a]">
                Events could not be loaded from the API. Please check that the Laravel server is running.
              </div>
            )}

            {activeTab === "ongoing" && (
              <section className="space-y-4" aria-labelledby="live-events-heading">
                {eventsLoading ? (
                  <LoadingEvents />
                ) : visibleLiveEvents.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {visibleLiveEvents.map((event) => (
                      <LiveEventCard
                        key={event.id}
                        event={event}
                        onRegistrationToggle={() => handleRegistrationToggle(event)}
                        registrationBusy={registrationBusySlug === event.sourceId}
                        onView={() => {
                          setInvitationMode("view");
                          setInvitationEvent(event);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState />
                )}
              </section>
            )}

            {activeTab === 'upcoming' && (
              <section className="space-y-4" aria-labelledby="upcoming-events-heading">
                <div className="flex items-end justify-between gap-4">
                  <h2 id="upcoming-events-heading" className="text-xl leading-7 font-semibold text-[#25170f]">
                    Upcoming Scheduled Events
                  </h2>
                </div>
                {eventsLoading ? (
                  <LoadingEvents />
                ) : visibleUpcomingEvents.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {visibleUpcomingEvents.map((event) => (
                      <UpcomingEventCard
                        key={event.id}
                        event={event}
                        onRegistrationToggle={() => handleRegistrationToggle(event)}
                        registrationBusy={registrationBusySlug === event.sourceId}
                        onView={() => {
                          setInvitationMode("view");
                          setInvitationEvent(event);
                        }}
                        onEdit={() => {
                          setEditingEvent(event);
                          setCreateOpen(true);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState />
                )}
              </section>
            )}
          </div>
        </main>
      </div>

      <CreateEventDialog
        key={editingEvent?.sourceId || "create-event"}
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setEditingEvent(null);
        }}
        onCreated={handleEventCreated}
        initialEvent={editingEvent?.editData}
      />
      <InvitationDialog
        event={invitationEvent}
        mode={invitationMode}
        open={Boolean(invitationEvent)}
        onOpenChange={(open) => {
          if (!open) setInvitationEvent(null);
        }}
      />
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed right-4 bottom-4 z-[60] flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-xl bg-[#283044] p-4 text-[#fffaf7] shadow-xl transition-all duration-300 sm:right-6 sm:bottom-6",
          toast ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0",
        )}
      >
        <CheckCircleToast />
        <div>
          <div className="text-xs leading-4 font-semibold text-white">{toast?.title || "Action Recorded"}</div>
          <div className="text-xs leading-4 text-[#8a766b]">
            {toast?.description || "Operation completed successfully."}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingEvents() {
  return (
    <div className="flex min-h-36 items-center justify-center rounded-2xl bg-white">
      <LoaderCircle className="size-6 animate-spin text-[#f6671e]" aria-label="Loading events" />
    </div>
  );
}

function CheckCircleToast() {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#6ffbbe] text-[#006c49]">
      <span className="text-sm leading-none font-bold">✓</span>
    </span>
  );
}

function EmptyState() {
  return (
    <Card className="flex min-h-36 flex-col items-center justify-center p-6 text-center">
      <Search className="mb-2 size-6 text-[#96877f]" />
      <p className="text-sm font-semibold text-[#25170f]">No matching events</p>
      <p className="text-xs text-[#6f625b]">Try a different title, venue, or category.</p>
    </Card>
  );
}

export default function Home() {
  const router = useRouter();
  const {
    user,
    error,
    isLoading,
    login,
    logout,
  } = useAuth();

  useEffect(() => {
    if (isLoading && !user && !error) return;

    document.title = !user
      ? "Login | Hype Event Hub"
      : user.role === "Admin"
        ? "Dashboard | Hype Event Hub"
        : user.role === "Scanner"
          ? "Check In & Scanner | Hype Event Hub"
          : "Access unavailable | Hype Event Hub";
  }, [error, isLoading, user]);

  useEffect(() => {
    if (isLoading || !user) return;

    const home = getRoleHome(user.role);
    if (home && home !== "/") router.replace(home);
  }, [isLoading, router, user]);

  async function handleLogin(credentials) {
    await login(credentials);
  }

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "Sign-out failed",
        text: getApiErrorMessage(error, "Please try again."),
        confirmButtonColor: "#dc4f0a",
      });
    }
  }

  if (isLoading && !user && !error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fffaf7] text-[#f6671e]">
        <LoaderCircle className="size-8 animate-spin" aria-label="Checking authentication" />
      </main>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (user.role === "Scanner") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fffaf7] text-[#f6671e]">
        <LoaderCircle className="size-8 animate-spin" aria-label="Redirecting to your workspace" />
      </main>
    );
  }

  if (user.role !== "Admin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fffaf7] p-4 text-[#25170f]">
        <Card className="w-full max-w-md space-y-4 p-6 text-center">
          <h1 className="text-xl font-semibold">Access unavailable</h1>
          <p className="text-sm text-[#6f625b]">This account does not have access to a workspace.</p>
          <Button type="button" onClick={handleLogout}>Logout</Button>
        </Card>
      </main>
    );
  }

  return <EventDashboard onLogout={handleLogout} user={user} />;
}
