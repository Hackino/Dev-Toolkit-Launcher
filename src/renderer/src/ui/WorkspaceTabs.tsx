import type { WorkspaceConfig } from '../../../shared/types';

type Props = {
  workspaces: WorkspaceConfig[];
  projectCounts: Record<string, number>;
  activeId: string | null;
  onSelect: (id: string) => void;
};

export default function WorkspaceTabs({ workspaces, projectCounts, activeId, onSelect }: Props) {
  if (workspaces.length === 0) return null;
  return (
    <nav className="workspace-tabs" aria-label="Workspaces">
      {workspaces.map((ws) => {
        const count = projectCounts[ws.id] ?? 0;
        const isActive = ws.id === activeId;
        return (
          <button
            key={ws.id}
            type="button"
            className={`workspace-tab ${isActive ? 'active' : ''}`}
            onClick={() => onSelect(ws.id)}
          >
            <span className="workspace-tab-label">{ws.name}</span>
            <span className="workspace-tab-count">{count}</span>
          </button>
        );
      })}
    </nav>
  );
}
