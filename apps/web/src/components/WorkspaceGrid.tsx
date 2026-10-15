/**
 * Multi-workspace grid: tile several threads side-by-side so parallel agent
 * work can be watched and driven from one screen. Each tile hosts a full
 * ChatView, so the composer, model/provider picker, and follow-ups keep
 * working per tile exactly as on the single-thread route.
 *
 * Tiles may also hold unsent threads (`draft:<draftId>` keys): starting a
 * new workspace from the grid mints a draft and tiles it immediately, so no
 * sidebar round-trip is needed before lining work up. Once a draft's first
 * message sends, its tile swaps to the promoted server thread key.
 *
 * Tiles in the same row resize with cursor-draggable dividers (double-click
 * equalizes), and each tile body resizes vertically with the native handle.
 */
import {
  parseScopedThreadKey,
  scopeProjectRef,
  scopeThreadRef,
  scopedThreadKey,
} from "@t3tools/client-runtime/environment";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import type { ScopedProjectRef, ScopedThreadRef } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { ExternalLinkIcon, PlusIcon, XIcon } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import ChatView from "./ChatView";
import { Button } from "./ui/button";
import { SidebarInset } from "./ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";
import { WorkspacePageHeader } from "./WorkspacePageHeader";
import { buildThreadRouteParams } from "../threadRoutes";
import { useThreadSelectionStore } from "../threadSelectionStore";
import { useProjects, useThreadShells } from "../state/entities";
import { useComposerDraftStore, DraftId, type DraftThreadState } from "../composerDraftStore";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { cn } from "~/lib/utils";
import {
  WORKSPACE_GRID_MAX_TILES,
  useWorkspaceGridStore,
  type WorkspaceGridColumns,
} from "../workspaceGridStore";
import {
  adjustRowWeights,
  buildWorkspaceDraftOptions,
  buildWorkspaceGridOptions,
  buildWorkspaceProjectNameById,
  chunkWorkspaceTiles,
  groupWorkspaceGridOptionsByProject,
  makeDraftTileKey,
  parseWorkspaceTileKey,
  resolveWorkspaceDraftTileHeading,
  resolveWorkspaceTileHeading,
} from "../workspaceGridOptions";

const COLUMN_OPTIONS: readonly WorkspaceGridColumns[] = [2, 3, 4];

/** Picker value that mints a fresh workspace instead of tiling an existing one. */
const NEW_WORKSPACE_VALUE = "__new__";

function WorkspaceTile({
  threadKey,
  title,
  projectName,
  draftSession,
  draftId,
  serverRef,
  onClose,
  onPopOut,
}: {
  readonly threadKey: string;
  readonly title: string;
  readonly projectName: string;
  readonly draftSession: DraftThreadState | null;
  readonly draftId: string | null;
  readonly serverRef: ScopedThreadRef | null;
  readonly onClose: () => void;
  readonly onPopOut: () => void;
}) {
  if (!draftSession && !serverRef) {
    return (
      <div className="flex h-40 items-center justify-between rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <span className="truncate">Unknown workspace “{threadKey}”.</span>
        <Button size="icon-xs" variant="ghost" aria-label="Remove workspace" onClick={onClose}>
          <XIcon className="size-3.5" />
        </Button>
      </div>
    );
  }
  return (
    <section
      aria-label={`Workspace tile: ${projectName}, ${title}`}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-muted/40 px-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{projectName}</span>
                <span aria-hidden="true"> — </span>
                <span className="font-mono">{title}</span>
              </span>
            }
          />
          <TooltipPopup side="top">{threadKey}</TooltipPopup>
        </Tooltip>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Open thread full-size"
          title="Open thread full-size"
          onClick={onPopOut}
        >
          <ExternalLinkIcon className="size-3.5" />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Remove workspace tile"
          title="Remove workspace tile"
          onClick={onClose}
        >
          <XIcon className="size-3.5" />
        </Button>
      </div>
      <div className="flex h-[560px] min-h-[300px] flex-col overflow-auto resize-y lg:h-[620px]">
        {draftSession && draftId ? (
          <ChatView
            environmentId={draftSession.environmentId}
            threadId={draftSession.threadId}
            routeKind="draft"
            draftId={DraftId.make(draftId)}
          />
        ) : serverRef ? (
          <ChatView
            environmentId={serverRef.environmentId}
            threadId={serverRef.threadId}
            routeKind="server"
          />
        ) : null}
      </div>
    </section>
  );
}

function WorkspaceGridDivider({
  onDelta,
  onReset,
}: {
  readonly onDelta: (dxPx: number, rowWidthPx: number) => void;
  readonly onReset: () => void;
}) {
  const startX = useRef<number | null>(null);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize workspaces"
      title="Drag to resize · double-click to equalize"
      className="flex w-3 shrink-0 cursor-col-resize touch-none select-none items-stretch justify-center"
      onPointerDown={(event) => {
        startX.current = event.clientX;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (startX.current === null) return;
        const row = event.currentTarget.closest("[data-workspace-row]");
        const rowWidth = row?.getBoundingClientRect().width ?? 0;
        onDelta(event.clientX - startX.current, rowWidth);
        startX.current = event.clientX;
      }}
      onPointerUp={() => {
        startX.current = null;
      }}
      onPointerCancel={() => {
        startX.current = null;
      }}
      onDoubleClick={onReset}
    >
      <div className="w-px bg-border transition-colors hover:bg-ring" />
    </div>
  );
}

export function WorkspaceGrid() {
  const navigate = useNavigate();
  const tiles = useWorkspaceGridStore((state) => state.tiles);
  const columns = useWorkspaceGridStore((state) => state.columns);
  const addTile = useWorkspaceGridStore((state) => state.addTile);
  const removeTile = useWorkspaceGridStore((state) => state.removeTile);
  const setTiles = useWorkspaceGridStore((state) => state.setTiles);
  const clearTiles = useWorkspaceGridStore((state) => state.clearTiles);
  const setColumns = useWorkspaceGridStore((state) => state.setColumns);
  const threads = useThreadShells();
  const projects = useProjects();
  const draftSessionsByKey = useComposerDraftStore((state) => state.draftThreadsByThreadKey);
  const { defaultProjectRef, handleNewThread } = useHandleNewThread();
  const [pickerValue, setPickerValue] = useState("");
  const [tileWeights, setTileWeights] = useState<Readonly<Record<string, number>>>({});

  const projectNameById = useMemo(() => buildWorkspaceProjectNameById(projects), [projects]);

  const draftById = useMemo(
    () => new Map<string, DraftThreadState>(Array.from(draftSessionsByKey)),
    [draftSessionsByKey],
  );

  const draftSessions = useMemo(
    () =>
      [...draftById.entries()].map(([draftId, session]) => ({
        draftId,
        environmentId: session.environmentId,
        projectId: session.projectId,
        createdAt: session.createdAt,
        promotedTo: session.promotedTo,
      })),
    [draftById],
  );

  const threadOptions = useMemo(
    () => buildWorkspaceGridOptions({ threads, projectNameById, tiles }),
    [threads, projectNameById, tiles],
  );

  const draftOptions = useMemo(
    () => buildWorkspaceDraftOptions({ drafts: draftSessions, projectNameById, tiles }),
    [draftSessions, projectNameById, tiles],
  );

  const groupedOptions = useMemo(
    () => groupWorkspaceGridOptionsByProject([...draftOptions, ...threadOptions]),
    [draftOptions, threadOptions],
  );

  const threadsByKey = useMemo(() => {
    const map = new Map<string, (typeof threads)[number]>();
    for (const thread of threads) {
      map.set(scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)), thread);
    }
    return map;
  }, [threads]);

  // A draft tile whose first message sent becomes its server thread tile.
  useEffect(() => {
    let changed = false;
    const next = tiles.map((key) => {
      const target = parseWorkspaceTileKey(key);
      if (target?.kind !== "draft") return key;
      const promotedTo = draftById.get(target.draftId)?.promotedTo;
      if (!promotedTo) return key;
      changed = true;
      return scopedThreadKey(promotedTo);
    });
    if (changed) {
      setTiles(next.filter((key, index) => next.indexOf(key) === index));
    }
  }, [tiles, draftById, setTiles]);

  // Forget sizes of tiles that left the grid.
  useEffect(() => {
    setTileWeights((previous) => {
      const live = new Set(tiles);
      if (Object.keys(previous).every((key) => live.has(key))) return previous;
      const pruned: Record<string, number> = {};
      for (const key of tiles) {
        if (previous[key] !== undefined) pruned[key] = previous[key]!;
      }
      return pruned;
    });
  }, [tiles]);

  const tileHeadings = useMemo(() => {
    const map = new Map<string, { title: string; projectName: string }>();
    for (const key of tiles) {
      const target = parseWorkspaceTileKey(key);
      if (target?.kind === "draft") {
        const session = draftById.get(target.draftId);
        const promotedTo = session?.promotedTo;
        if (promotedTo) {
          const heading = resolveWorkspaceTileHeading({
            threadKey: scopedThreadKey(promotedTo),
            threadsByKey,
            projectNameById,
          });
          if (heading) map.set(key, heading);
        } else if (session) {
          map.set(key, resolveWorkspaceDraftTileHeading({ draft: session, projectNameById }));
        }
        continue;
      }
      const heading = resolveWorkspaceTileHeading({
        threadKey: key,
        threadsByKey,
        projectNameById,
      });
      if (heading) map.set(key, heading);
    }
    return map;
  }, [tiles, threadsByKey, projectNameById, draftById]);

  const missingTiles = useMemo(() => {
    const liveKeys = new Set(
      threads.map((thread) => scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))),
    );
    return tiles.filter((key) => {
      const target = parseWorkspaceTileKey(key);
      if (target?.kind === "draft") {
        const session = draftById.get(target.draftId);
        return !session || session.promotedTo == null
          ? !session
          : !liveKeys.has(scopedThreadKey(session.promotedTo));
      }
      return !liveKeys.has(key);
    });
  }, [tiles, threads, draftById]);

  const rows = useMemo(() => chunkWorkspaceTiles(tiles, columns), [tiles, columns]);

  // Mint a draft in place and tile it — no sidebar round-trip needed first.
  const startNewWorkspaceTile = useCallback(
    async (projectRef: ScopedProjectRef) => {
      const created = await handleNewThread(projectRef, { replace: true });
      if (!created) return;
      addTile(makeDraftTileKey(String(created.draftId)));
      await navigate({ to: "/grid" });
    },
    [handleNewThread, addTile, navigate],
  );

  const handleDividerDelta = useCallback(
    (rowKeys: ReadonlyArray<string>, index: number, dxPx: number, rowWidthPx: number) => {
      if (!(rowWidthPx > 0)) return;
      setTileWeights((previous) => {
        const weights = rowKeys.map((key) => previous[key] ?? 1);
        const next = adjustRowWeights({ weights, index, deltaFraction: dxPx / rowWidthPx });
        const merged: Record<string, number> = { ...previous };
        rowKeys.forEach((key, position) => {
          merged[key] = next[position]!;
        });
        return merged;
      });
    },
    [],
  );

  const handleDividerReset = useCallback((rowKeys: ReadonlyArray<string>) => {
    setTileWeights((previous) => {
      const merged: Record<string, number> = { ...previous };
      for (const key of rowKeys) delete merged[key];
      return merged;
    });
  }, []);

  const renderTile = useCallback(
    (key: string) => {
      const target = parseWorkspaceTileKey(key);
      if (target?.kind === "draft") {
        const session = draftById.get(target.draftId);
        const promotedTo = session?.promotedTo;
        if (promotedTo) {
          const serverKey = scopedThreadKey(promotedTo);
          const heading = tileHeadings.get(key) ??
            tileHeadings.get(serverKey) ?? { title: key, projectName: "Unavailable" };
          return (
            <WorkspaceTile
              threadKey={key}
              title={heading.title}
              projectName={heading.projectName}
              draftSession={null}
              draftId={null}
              serverRef={promotedTo}
              onClose={() => removeTile(key)}
              onPopOut={() => {
                void navigate({
                  to: "/$environmentId/$threadId",
                  params: buildThreadRouteParams(promotedTo),
                });
              }}
            />
          );
        }
        if (!session) {
          return (
            <WorkspaceTile
              threadKey={key}
              title={key}
              projectName="Unavailable"
              draftSession={null}
              draftId={null}
              serverRef={null}
              onClose={() => removeTile(key)}
              onPopOut={() => {}}
            />
          );
        }
        const heading = tileHeadings.get(key) ?? { title: "New thread", projectName: "" };
        return (
          <WorkspaceTile
            threadKey={key}
            title={heading.title}
            projectName={heading.projectName}
            draftSession={session}
            draftId={target.draftId}
            serverRef={null}
            onClose={() => removeTile(key)}
            onPopOut={() => {
              void navigate({
                to: "/draft/$draftId",
                params: { draftId: DraftId.make(target.draftId) },
              });
            }}
          />
        );
      }
      const heading = tileHeadings.get(key) ?? { title: key, projectName: "Unavailable" };
      return (
        <WorkspaceTile
          threadKey={key}
          title={heading.title}
          projectName={heading.projectName}
          draftSession={null}
          draftId={null}
          serverRef={parseScopedThreadKey(key)}
          onClose={() => removeTile(key)}
          onPopOut={() => {
            const ref = parseScopedThreadKey(key);
            if (!ref) return;
            void navigate({
              to: "/$environmentId/$threadId",
              params: buildThreadRouteParams(ref),
            });
          }}
        />
      );
    },
    [draftById, tileHeadings, removeTile, navigate],
  );

  return (
    <SidebarInset className="h-svh min-h-0 overflow-y-auto overscroll-y-none bg-background text-foreground md:h-dvh">
      <WorkspacePageHeader className="sticky top-0 z-10 h-auto min-h-[var(--workspace-topbar-height)] flex-wrap gap-x-3 gap-y-2 bg-background py-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="shrink-0 text-sm font-semibold">Workspaces</h1>
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {tiles.length}/{WORKSPACE_GRID_MAX_TILES} open
            <span className="hidden lg:inline"> · each tile runs its own provider</span>
          </span>
        </div>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          <div
            role="group"
            aria-label="Grid columns"
            className="flex shrink-0 items-center rounded-md bg-muted p-0.5"
          >
            {COLUMN_OPTIONS.map((option) => (
              <Button
                key={option}
                size="xs"
                variant={columns === option ? "default" : "ghost"}
                aria-pressed={columns === option}
                title={`${option} columns`}
                onClick={() => setColumns(option)}
              >
                {option}
              </Button>
            ))}
          </div>
          <select
            aria-label="Add workspace tile"
            value={pickerValue}
            disabled={tiles.length >= WORKSPACE_GRID_MAX_TILES}
            onChange={(event) => {
              const value = event.target.value;
              setPickerValue("");
              if (!value) return;
              if (value === NEW_WORKSPACE_VALUE) {
                if (defaultProjectRef) void startNewWorkspaceTile(defaultProjectRef);
                return;
              }
              addTile(value);
            }}
            className={cn(
              "h-8 w-44 shrink-0 rounded-md border border-input bg-background px-2 text-xs",
              "sm:w-56",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <option value="">+ Add workspace…</option>
            {defaultProjectRef ? <option value={NEW_WORKSPACE_VALUE}>+ New thread…</option> : null}
            {groupedOptions.map((group) => {
              const available = group.options.filter((option) => !option.added);
              if (available.length === 0) return null;
              return (
                <optgroup key={group.projectName} label={group.projectName}>
                  {available.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.title} ({option.model})
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Remove all tiles"
            title="Remove all tiles"
            disabled={tiles.length === 0}
            onClick={clearTiles}
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      </WorkspacePageHeader>

      <div className="min-h-0 flex-1 p-3 sm:p-4">
        {tiles.length === 0 ? (
          <WorkspaceGridEmptyState
            hasThreads={threadOptions.length > 0}
            onOpenAll={(keys) => setTiles(keys)}
            threadKeys={threadOptions.map((option) => option.key)}
            projects={projects}
            onStartNew={(projectRef) => void startNewWorkspaceTile(projectRef)}
          />
        ) : (
          <div className="flex min-h-0 flex-col gap-3">
            {rows.map((rowKeys) => (
              <div
                key={rowKeys.join("|")}
                data-workspace-row
                className="flex min-h-0 items-stretch"
              >
                {rowKeys.map((key, position) => (
                  <Fragment key={key}>
                    {position > 0 ? (
                      <WorkspaceGridDivider
                        onDelta={(dxPx, rowWidthPx) =>
                          handleDividerDelta(rowKeys, position - 1, dxPx, rowWidthPx)
                        }
                        onReset={() => handleDividerReset(rowKeys)}
                      />
                    ) : null}
                    <div
                      className="min-w-0"
                      style={{
                        flexGrow: tileWeights[key] ?? 1,
                        flexShrink: 1,
                        flexBasis: 0,
                      }}
                    >
                      {renderTile(key)}
                    </div>
                  </Fragment>
                ))}
              </div>
            ))}
          </div>
        )}

        {missingTiles.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {missingTiles.length} tiled workspace{missingTiles.length === 1 ? " is" : "s are"} no
            longer available (deleted or still syncing).{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => {
                for (const key of missingTiles) removeTile(key);
              }}
            >
              Clear {missingTiles.length === 1 ? "it" : "them"}
            </button>
          </p>
        ) : null}
      </div>
    </SidebarInset>
  );
}

function WorkspaceGridEmptyState({
  hasThreads,
  threadKeys,
  onOpenAll,
  projects,
  onStartNew,
}: {
  readonly hasThreads: boolean;
  readonly threadKeys: readonly string[];
  readonly onOpenAll: (keys: readonly string[]) => void;
  readonly projects: ReadonlyArray<EnvironmentProject>;
  readonly onStartNew: (projectRef: ScopedProjectRef) => void;
}) {
  const selectedThreadKeys = useThreadSelectionStore((state) => state.selectedThreadKeys);
  const selectedKeys = useMemo(
    () => [...selectedThreadKeys].filter((key) => threadKeys.includes(key)),
    [selectedThreadKeys, threadKeys],
  );
  const [projectKey, setProjectKey] = useState("");
  const activeProjectKey =
    projectKey || (projects[0] ? `${projects[0].environmentId}:${projects[0].id}` : "");
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center">
      <div className="flex size-10 items-center justify-center rounded-md bg-muted">
        <PlusIcon className="size-5 text-muted-foreground" />
      </div>
      <h2 className="text-base font-semibold">Open workspaces side-by-side</h2>
      <p className="text-sm text-muted-foreground">
        {hasThreads
          ? "Pick threads from the “Add workspace” menu above — or multi-select threads in the sidebar (Ctrl+click) and open them here together. Each tile keeps its own provider and runs in parallel."
          : "No threads yet. Start your first workspace below and tile more beside it as you go."}
      </p>
      {projects.length > 0 ? (
        <div className="flex w-full max-w-sm flex-col gap-2">
          <label className="sr-only" htmlFor="workspace-grid-new-project">
            Project for the new workspace
          </label>
          <select
            id="workspace-grid-new-project"
            value={activeProjectKey}
            onChange={(event) => setProjectKey(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {projects.map((project) => {
              const value = `${project.environmentId}:${project.id}`;
              return (
                <option key={value} value={value}>
                  {project.title}
                </option>
              );
            })}
          </select>
          <Button
            size="sm"
            onClick={() => {
              const project = projects.find(
                (candidate) => `${candidate.environmentId}:${candidate.id}` === activeProjectKey,
              );
              if (!project) return;
              onStartNew(scopeProjectRef(project.environmentId, project.id));
            }}
          >
            Start new workspace
          </Button>
        </div>
      ) : null}
      {selectedKeys.length > 1 ? (
        <Button size="sm" variant="secondary" onClick={() => onOpenAll(selectedKeys)}>
          Open {selectedKeys.length} selected threads
        </Button>
      ) : null}
    </div>
  );
}
