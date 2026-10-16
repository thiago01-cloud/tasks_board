"use client";

import { createContext, useContext, useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

// Shared with TaskFilters.tsx's "Réinitialiser" button, which clears this
// key directly (see its own comment) rather than going through
// FilterMemory below.
export const TASK_FILTERS_STORAGE_KEY = "tasks:filters";

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

// "Garder en mémoire les filtres dans tâches" — makes a bare
// /dashboard/tasks visit (no query params at all) restore whatever
// assigné/priorité/groupe/statut combination was last explicitly picked,
// instead of always re-running page.tsx's own smart-default cascade.
// Renders nothing; just watches the two values page.tsx already computed:
//   - `hasExplicitFilter` true (the URL carries at least one filter param,
//     however it got there): save `queryString` — built from the actual
//     params, never from a cascade default — as the new memory.
//   - `hasExplicitFilter` false (bare visit): if something was saved
//     before, redirect once to it so the cascade never even runs. Nothing
//     saved (first-ever visit, or right after "Réinitialiser" cleared it
//     — see TaskFilters.tsx) means there's nothing to restore, so the
//     cascade's own default stands.
// A `useRef` guards against redirecting more than once per mount (the
// effect also re-runs if `queryString` changes for unrelated reasons).
export function FilterMemory({
  hasExplicitFilter,
  queryString,
}: {
  hasExplicitFilter: boolean;
  queryString: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (hasExplicitFilter) {
      try {
        window.localStorage.setItem(TASK_FILTERS_STORAGE_KEY, queryString);
      } catch {
        // Private browsing / storage disabled — filters just won't persist.
      }
      return;
    }
    if (redirected.current) return;
    let saved = "";
    try {
      saved = window.localStorage.getItem(TASK_FILTERS_STORAGE_KEY) || "";
    } catch {
      saved = "";
    }
    if (saved) {
      redirected.current = true;
      router.replace(`${pathname}?${saved}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasExplicitFilter, queryString]);

  return null;
}
