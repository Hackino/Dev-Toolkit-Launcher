import { useCallback, useEffect, useState } from 'react';
import type {
  ProjectCategory,
  ProjectConfig,
  ProjectCreateInput,
  ProjectType,
  ProjectUpdateInput,
  ExternalLink,
  TechTag,
  WorkspaceConfig,
} from '../../../shared/types';
import { PROJECT_TYPE_LABELS, TECH_TAG_LABELS } from '../../../shared/types';
import MobileFormPanel from './MobileFormPanel';
import { PlatformLogo } from '../capabilities/logos/mobileLogos';
import { isMobileType } from '../../../shared/category';

const AVAILABLE_TAGS = Object.keys(TECH_TAG_LABELS) as TechTag[];

type Props = {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
};

// Backend/Web Type dropdown lists backend types only — mobile platforms live in the Mobile tab.
const PROJECT_TYPES = (Object.keys(PROJECT_TYPE_LABELS) as ProjectType[]).filter((t) => !isMobileType(t));

// Per-language guidance for what the path must point at.
type PathGuide = { target: string; example: string; note?: string };
const PATH_GUIDE: Record<string, PathGuide> = {
  'dotnet': {
    target: 'The .csproj project file (not the solution).',
    example: '~/apps/MyApi/MyApi.csproj',
    note: 'Profiles are read from Properties/launchSettings.json next to it.',
  },
  'spring-boot': {
    target: 'The project root — the folder containing build.gradle / pom.xml.',
    example: '~/apps/my-service',
    note: 'Spring profiles come from src/main/resources/application-*.yml.',
  },
  'ktor': {
    target: 'The project root — the folder containing build.gradle.',
    example: '~/apps/my-ktor-app',
    note: 'Port is read from src/main/resources/application.conf.',
  },
  'nextjs': { target: 'The app root — the folder containing package.json.', example: '~/apps/my-next-app', note: 'Profiles = your package.json scripts.' },
  'react': { target: 'The app root — the folder containing package.json.', example: '~/apps/my-react-app', note: 'Profiles = your package.json scripts.' },
  'nodejs': { target: 'The app root — the folder containing package.json.', example: '~/apps/my-node-app', note: 'Profiles = your package.json scripts.' },
  'express': { target: 'The app root — the folder containing package.json.', example: '~/apps/my-express-api', note: 'Profiles = your package.json scripts.' },
  'nestjs': { target: 'The app root — the folder containing package.json.', example: '~/apps/my-nest-api', note: 'Profiles = your package.json scripts.' },
};

function PathInfoTip({ type }: { type: ProjectType }) {
  const guide = PATH_GUIDE[type];
  if (!guide) return null;
  return (
    <span className="info-tip" tabIndex={0} aria-label="Path help">
      <span className="info-tip-icon">ⓘ</span>
      <span className="info-tip-pop" role="tooltip">
        <strong>Where should the path point?</strong>
        <span>{guide.target}</span>
        <code className="info-tip-example">{guide.example}</code>
        {guide.note && <span className="info-tip-note">{guide.note}</span>}
      </span>
    </span>
  );
}

// ─── Empty form ───────────────────────────────────────────────────────────────

type ProjectForm = {
  name: string;
  type: ProjectType;
  path: string;
  tags: string[];
  externalUrls: ExternalLink[];
  envPairs: Array<{ key: string; value: string }>;
};

const EMPTY_FORM: ProjectForm = {
  name: '',
  type: 'dotnet',
  path: '',
  tags: [],
  externalUrls: [],
  envPairs: [],
};

function envFromPairs(envPairs: ProjectForm['envPairs']): Record<string, string> {
  const env: Record<string, string> = {};
  for (const { key, value } of envPairs) {
    if (key.trim()) env[key.trim()] = value;
  }
  return env;
}

function formToCreateInput(form: ProjectForm, workspaceId: string): ProjectCreateInput {
  return {
    workspaceId,
    name: form.name.trim(),
    type: form.type,
    path: form.path.trim(),
    externalUrls: form.externalUrls.filter((l) => l.url.trim()),
    tags: form.tags,
    env: envFromPairs(form.envPairs),
    runCommand: '', // backend run is profile-driven; no manual command
  };
}

function formToUpdateInput(form: ProjectForm): ProjectUpdateInput {
  return {
    name: form.name.trim(),
    type: form.type,
    path: form.path.trim(),
    externalUrls: form.externalUrls.filter((l) => l.url.trim()),
    tags: form.tags,
    env: envFromPairs(form.envPairs),
  };
}

function projectToForm(p: ProjectConfig): ProjectForm {
  return {
    name: p.name,
    type: p.type,
    path: p.path,
    tags: p.tags,
    externalUrls: p.externalUrls,
    envPairs: Object.entries(p.env).map(([key, value]) => ({ key, value })),
  };
}

// ─── Project form component ───────────────────────────────────────────────────

function ProjectFormPanel({
  form,
  onChange,
  onBrowse,
  onTypeChange,
}: {
  form: ProjectForm;
  onChange: (f: ProjectForm) => void;
  onBrowse: () => void;
  onTypeChange: (type: ProjectType) => void;
}) {
  const set = <K extends keyof ProjectForm>(k: K, v: ProjectForm[K]) => onChange({ ...form, [k]: v });
  const setStr = (k: keyof ProjectForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    set(k as keyof ProjectForm, e.target.value as ProjectForm[typeof k]);
  const toggleTag = (tag: string) => {
    const next = form.tags.includes(tag) ? form.tags.filter((t) => t !== tag) : [...form.tags, tag];
    set('tags', next);
  };
  const addEnvRow = () => onChange({ ...form, envPairs: [...form.envPairs, { key: '', value: '' }] });
  const removeEnvRow = (i: number) =>
    onChange({ ...form, envPairs: form.envPairs.filter((_, idx) => idx !== i) });
  const setEnvRow = (i: number, k: string, v: string) => {
    const next = [...form.envPairs];
    next[i] = { key: k, value: v };
    onChange({ ...form, envPairs: next });
  };

  const addUrlRow = () =>
    onChange({ ...form, externalUrls: [...form.externalUrls, { id: crypto.randomUUID(), name: '', url: '' }] });
  const removeUrlRow = (id: string) =>
    onChange({ ...form, externalUrls: form.externalUrls.filter((l) => l.id !== id) });
  const setUrlRow = (id: string, patch: Partial<ExternalLink>) =>
    onChange({ ...form, externalUrls: form.externalUrls.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

  const isDotnet = form.type === 'dotnet';
  const pathHint = isDotnet ? 'Path to the .csproj file' : 'Project folder';

  return (
    <div className="pf-body">
      <label className="pf-field">
        <span>Name</span>
        <input type="text" value={form.name} onChange={setStr('name')} placeholder="My Service" autoFocus />
      </label>

      <label className="pf-field">
        <span>Type</span>
        <select value={form.type} onChange={(e) => onTypeChange(e.target.value as ProjectType)}>
          {PROJECT_TYPES.map((t) => (
            <option key={t} value={t}>{PROJECT_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </label>

      <div className="pf-field">
        <span>Tech Stack <small>(optional)</small></span>
        <div className="pf-tags">
          {AVAILABLE_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`pf-tag-chip ${form.tags.includes(tag) ? 'active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              {TECH_TAG_LABELS[tag]}
            </button>
          ))}
        </div>
      </div>

      <label className="pf-field">
        <span>Path <small>({pathHint})</small><PathInfoTip type={form.type} /></span>
        <div className="pf-row">
          <input
            type="text"
            value={form.path}
            onChange={setStr('path')}
            placeholder={isDotnet ? '/path/to/App.csproj' : '/path/to/project'}
            className="pf-mono"
          />
          <button type="button" className="btn ghost" onClick={onBrowse}>Browse…</button>
        </div>
        <span className="pf-field-hint">
          Profiles, ports, and build command are auto-detected from the project — nothing to type.
        </span>
      </label>

      <div className="pf-field">
        <div className="pf-env-header">
          <span>External URLs <small>(hosted / staging links)</small></span>
          <button type="button" className="btn ghost pf-env-add" onClick={addUrlRow}>+ Add</button>
        </div>
        <div className="pf-env-list">
          {form.externalUrls.map((link) => (
            <div key={link.id} className="pf-env-row">
              <input
                type="text"
                value={link.name}
                placeholder="Name (e.g. Production)"
                onChange={(e) => setUrlRow(link.id, { name: e.target.value })}
              />
              <input
                type="text"
                value={link.url}
                placeholder="https://my-app.example.com"
                className="pf-mono"
                onChange={(e) => setUrlRow(link.id, { url: e.target.value })}
              />
              <button type="button" className="pf-env-remove" onClick={() => removeUrlRow(link.id)}>✕</button>
            </div>
          ))}
          {form.externalUrls.length === 0 && (
            <span className="pf-env-empty">No external URLs</span>
          )}
        </div>
      </div>

      <div className="pf-field">
        <div className="pf-env-header">
          <span>Environment variables</span>
          <button type="button" className="btn ghost pf-env-add" onClick={addEnvRow}>+ Add</button>
        </div>
        <div className="pf-env-list">
          {form.envPairs.map(({ key, value }, i) => (
            <div key={i} className="pf-env-row">
              <input
                type="text"
                value={key}
                placeholder="KEY"
                className="pf-mono"
                onChange={(e) => setEnvRow(i, e.target.value, value)}
              />
              <span>=</span>
              <input
                type="text"
                value={value}
                placeholder="value"
                className="pf-mono"
                onChange={(e) => setEnvRow(i, key, e.target.value)}
              />
              <button type="button" className="pf-env-remove" onClick={() => removeEnvRow(i)}>✕</button>
            </div>
          ))}
          {form.envPairs.length === 0 && (
            <span className="pf-env-empty">No variables set</span>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Main WorkspaceManager ────────────────────────────────────────────────────

type EditingProject = { mode: 'create' } | { mode: 'edit'; project: ProjectConfig };

export default function WorkspaceManager({ open, onClose, onChanged }: Props) {
  const [workspaces, setWorkspaces] = useState<WorkspaceConfig[]>([]);
  const [projects, setProjects] = useState<Record<string, ProjectConfig[]>>({});
  const [selectedWsId, setSelectedWsId] = useState<string | null>(null);
  const [editingWsId, setEditingWsId] = useState<string | null>(null);
  const [editingWsName, setEditingWsName] = useState('');
  const [newWsName, setNewWsName] = useState('');
  const [editingProject, setEditingProject] = useState<EditingProject | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectForm>(EMPTY_FORM);
  const [categoryTab, setCategoryTab] = useState<ProjectCategory>('backend');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const wsList = await window.launcher.listWorkspaces();
    setWorkspaces(wsList);
    if (wsList.length > 0) {
      const firstId = wsList[0].id;
      setSelectedWsId((cur) => cur && wsList.some((w) => w.id === cur) ? cur : firstId);
    }
    // Load all projects
    const all: Record<string, ProjectConfig[]> = {};
    await Promise.all(
      wsList.map(async (ws) => {
        all[ws.id] = await window.launcher.listProjects(ws.id);
      }),
    );
    setProjects(all);
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
    setEditingProject(null);
    setNewWsName('');
    setError(null);
  }, [open, load]);

  if (!open) return null;

  const selectedWs = workspaces.find((w) => w.id === selectedWsId);
  const selectedProjects = selectedWsId ? (projects[selectedWsId] ?? []) : [];

  // ── Workspace actions ───────────────────────────────────────────────────────

  const addWorkspace = async () => {
    if (!newWsName.trim()) return;
    const ws = await window.launcher.createWorkspace({ name: newWsName.trim() });
    setNewWsName('');
    await load();
    setSelectedWsId(ws.id);
    onChanged();
  };

  const saveWsName = async (id: string) => {
    if (!editingWsName.trim()) return;
    await window.launcher.updateWorkspace(id, { name: editingWsName.trim() });
    setEditingWsId(null);
    await load();
    onChanged();
  };

  const deleteWorkspace = async (id: string) => {
    if (!confirm(`Delete this workspace and all its projects?`)) return;
    await window.launcher.deleteWorkspace(id);
    if (selectedWsId === id) setSelectedWsId(null);
    await load();
    onChanged();
  };

  // ── Project actions ─────────────────────────────────────────────────────────

  const startCreateProject = () => {
    if (!selectedWsId) return;
    setProjectForm({ ...EMPTY_FORM });
    setCategoryTab('backend');
    setEditingProject({ mode: 'create' });
    setError(null);
  };

  const startEditProject = (p: ProjectConfig) => {
    setProjectForm(projectToForm(p));
    setCategoryTab(isMobileType(p.type) ? 'mobile' : 'backend');
    setEditingProject({ mode: 'edit', project: p });
    setError(null);
  };

  const handleTypeChange = (type: ProjectType) => {
    setProjectForm((f) => ({ ...f, type }));
  };

  const browseProjectPath = async () => {
    const picked =
      projectForm.type === 'dotnet'
        ? await window.launcher.mobilePickFile({
            defaultPath: projectForm.path || undefined,
            title: 'Select the .csproj file',
            filters: [{ name: 'C# project', extensions: ['csproj'] }],
          })
        : await window.launcher.pickDirectory({
            defaultPath: projectForm.path || undefined,
            title: 'Select project folder',
          });
    if (picked) setProjectForm((f) => ({ ...f, path: picked }));
  };

  const saveProject = async () => {
    if (!projectForm.name.trim()) { setError('Name is required'); return; }
    if (!projectForm.path.trim()) { setError('Path is required'); return; }
    if (!selectedWsId) return;

    setSaving(true);
    setError(null);
    try {
      if (editingProject?.mode === 'create') {
        await window.launcher.createProject(formToCreateInput(projectForm, selectedWsId));
      } else if (editingProject?.mode === 'edit') {
        await window.launcher.updateProject(editingProject.project.id, formToUpdateInput(projectForm));
      }
      await load();
      onChanged();
      setEditingProject(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async (p: ProjectConfig) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    await window.launcher.deleteProject(p.id);
    await load();
    onChanged();
  };

  return (
    <div
      className="settings-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wm-title"
    >
      <div className="wm-dialog">
        <header className="settings-header">
          <h2 id="wm-title">Manage Projects</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="wm-body">
          {/* ── Left panel: workspaces ──────────────────────────────────────── */}
          <aside className="wm-sidebar">
            <div className="wm-sidebar-header">Workspaces</div>

            <ul className="wm-ws-list">
              {workspaces.map((ws) => (
                <li
                  key={ws.id}
                  className={`wm-ws-item ${selectedWsId === ws.id ? 'active' : ''}`}
                  onClick={() => { setSelectedWsId(ws.id); setEditingProject(null); }}
                >
                  {editingWsId === ws.id ? (
                    <input
                      className="wm-ws-name-input"
                      value={editingWsName}
                      autoFocus
                      onChange={(e) => setEditingWsName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveWsName(ws.id);
                        if (e.key === 'Escape') setEditingWsId(null);
                      }}
                      onBlur={() => saveWsName(ws.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span
                        className="wm-ws-name"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingWsId(ws.id);
                          setEditingWsName(ws.name);
                        }}
                      >
                        {ws.name}
                      </span>
                      <span className="wm-ws-count">{(projects[ws.id] ?? []).length}</span>
                    </>
                  )}
                  <button
                    className="wm-ws-delete"
                    title="Delete workspace"
                    onClick={(e) => { e.stopPropagation(); deleteWorkspace(ws.id); }}
                  >✕</button>
                </li>
              ))}
            </ul>

            <div className="wm-add-ws">
              <input
                type="text"
                placeholder="New workspace name…"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addWorkspace(); }}
              />
              <button
                type="button"
                className="btn ghost"
                onClick={addWorkspace}
                disabled={!newWsName.trim()}
              >+</button>
            </div>
          </aside>

          {/* ── Right panel: projects ───────────────────────────────────────── */}
          <main className="wm-content">
            {!selectedWs ? (
              <div className="wm-empty">
                Add a workspace tab on the left to get started.
              </div>
            ) : editingProject ? (
              // Project editor
              <>
                {/* Category tabs — shown for create, locked for edit */}
                {editingProject.mode === 'create' && (
                  <div className="wm-category-tabs">
                    {(['backend', 'mobile'] as ProjectCategory[]).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`wm-category-tab ${categoryTab === cat ? 'active' : ''}`}
                        onClick={() => setCategoryTab(cat)}
                      >
                        {cat === 'backend' ? 'Backend / Web' : 'Mobile'}
                      </button>
                    ))}
                  </div>
                )}

                {categoryTab === 'mobile' ? (
                  <MobileFormPanel
                    workspaceId={selectedWsId!}
                    editingProject={editingProject.mode === 'edit' ? editingProject.project : null}
                    onSaved={async () => { await load(); onChanged(); setEditingProject(null); }}
                    onCancel={() => setEditingProject(null)}
                  />
                ) : (
                  <div className="wm-project-editor">
                    <div className="wm-pe-header">
                      <h3>{editingProject.mode === 'create' ? 'New Project' : 'Edit Project'}</h3>
                      <span className="wm-pe-ws">in {selectedWs.name}</span>
                    </div>

                    <ProjectFormPanel
                      form={projectForm}
                      onChange={setProjectForm}
                      onBrowse={browseProjectPath}
                      onTypeChange={handleTypeChange}
                    />

                    {error && <div className="wm-error">{error}</div>}

                    <div className="wm-pe-actions">
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => setEditingProject(null)}
                        disabled={saving}
                      >Cancel</button>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={saveProject}
                        disabled={saving}
                      >{saving ? 'Saving…' : editingProject.mode === 'create' ? 'Add Project' : 'Save'}</button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Project list
              <>
                <div className="wm-projects-header">
                  <span>Projects in <strong>{selectedWs.name}</strong></span>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={startCreateProject}
                  >+ Add Project</button>
                </div>

                {selectedProjects.length === 0 ? (
                  <div className="wm-empty">
                    No projects yet. Click <strong>+ Add Project</strong> to add one.
                  </div>
                ) : (
                  <ul className="wm-project-list">
                    {selectedProjects.map((p) => (
                      <li key={p.id} className="wm-project-item">
                        {isMobileType(p.type) ? (
                          <span
                            className="wm-project-type-badge wm-project-badge--mobile"
                            data-type={p.type}
                          >
                            <PlatformLogo platform={p.type} size={14} />
                            {PROJECT_TYPE_LABELS[p.type]}
                          </span>
                        ) : (
                          <span
                            className="wm-project-type-badge"
                            data-type={p.type}
                          >
                            {PROJECT_TYPE_LABELS[p.type]}
                          </span>
                        )}
                        <div className="wm-project-info">
                          <span className="wm-project-name">{p.name}</span>
                          <span className="wm-project-path" title={p.path}>{p.path}</span>
                        </div>
                        <div className="wm-project-actions">
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => startEditProject(p)}
                            title="Edit"
                          >✎</button>
                          <button
                            type="button"
                            className="btn ghost wm-project-del"
                            onClick={() => deleteProject(p)}
                            title="Delete"
                          >✕</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
