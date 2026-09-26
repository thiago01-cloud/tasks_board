"use client";

import { createContext, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";

// Every filter change (TaskFilters.tsx) re-renders the whole board from
// the server — a real navigation, not instant. Wrapping it in a
// transition (React's useTransition) is what lets us show a small
// "loading" ring next to the "Tâches" title while that's in flight,
// without blocking the filters themselves or the currently-visible board
// (they keep responding immediately; only the ring reacts to isPending).
//
// The provider lives here, in page.tsx, wrapping both the title (which
// shows <TaskLoadingIndicator />) and the board (whose TaskFilters.tsx
// calls navigate() instead of router.push() directly) — two different
// branches of the tree that otherwise have no reason to share state.
type TaskNavigationValue = {
  isPending: boolean;
  navigate: (url: string) => void;
};

const TaskNavigationContext = createContext<TaskNavigationValue | null>(null);

export function TaskNavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(url: string) {
    startTransition(() => {
      router.push(url);
    });
  }

  return (
    <TaskNavigationContext.Provider value={{ isPending, navigate }}>
      {children}
    </TaskNavigationContext.Provider>
  );
}

function useTaskNavigation(): TaskNavigationValue {
  const ctx = useContext(TaskNavigationContext);
  if (!ctx) {
    throw new Error("useTaskNavigation must be used within <TaskNavigationProvider>.");
  }
  return ctx;
}

// Lets TaskFilters.tsx trigger the same tracked navigation the title's
// spinner is watching, instead of calling useRouter() on its own.
export function useTaskFilterNavigate(): (url: string) => void {
  return useTaskNavigation().navigate;
}

// The ring itself — sits right next to the "Tâches" title (see page.tsx),
// invisible until a filter change is actually in flight.
export function TaskLoadingIndicator() {
  const { isPending } = useTaskNavigation();
  if (!isPending) return null;
  return <span className="task-loading-spinner" role="status" aria-label="Chargement des tâches..." />;
}
