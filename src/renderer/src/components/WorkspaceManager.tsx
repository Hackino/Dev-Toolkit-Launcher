import { useCallback, useEffect, useState } from 'react';
import type {
  ProjectCategory,
  ProjectConfig,
  ProjectCreateInput,
  ProjectType,
  ProjectUpdateInput,
  RunProfile,
  RunProfileCreateInput,
  TechTag,
  WorkspaceConfig,
} from '../../../shared/types';
import { PROJECT_TYPE_LABELS, TECH_TAG_LABELS } from '../../../shared/types';
import MobileFormPanel from './mobile/MobileFormPanel';
import { PlatformLogo } from './mobile/mobileLogos';
import { isMobileType } from '../../../shared/category';

const AVAILABLE_TAGS = Object.keys(TECH_TAG_LABELS) as TechTag[];

type Props = {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
};

// Backend/Web Type dropdown lists backend types only — mobile platforms live in the Mobile tab.
const PROJECT_TYPES = (Object.keys(PROJECT_TYPE_LABELS) as ProjectType[]).filter((t) => !isMobileType(t));

// ─── Empty form ───────────────────────────────────────────────────────────────

type ProjectForm = {
  name: string;
  type: ProjectType;
  path: string;
  port: string;
  https: boolean;
  externalUrl: string;
  tags: string[];
  runCommand: string;
  buildCommand: string;
  envPairs: Array<{ key: string; value: string }>;
};

const EMPTY_FORM: ProjectForm = {
  name: '',
  type: 'dotnet',
  path: '',
  port: '',
  https: false,
  externalUrl: '',
  tags: [],
  runCommand: '',
  buildCommand: '',
  envPairs: [],
};

function formToCreateInput(form: ProjectForm, workspaceId: string): ProjectCreateInput {
  const env: Record<string, string> = {};
  for (const { key, value } of form.envPairs) {
    if (key.trim()) env[key.trim()] = value;
  }
  return {
    workspaceId,
    name: form.name.trim(),
    type: form.type,
    path: form.path.trim(),
    port: form.port ? parseInt(form.port, 10) : null,
    https: form.https,
    externalUrl: form.externalUrl.trim() || null,
    tags: form.tags,
    env,
    runCommand: form.runCommand.trim() || undefined,
    buildCommand: form.buildCommand.trim() || null,
  };
}

function formToUpdateInput(form: ProjectForm): ProjectUpdateInput {
  const env: Record<string, string> = {};
  for (const { key, value } of form.envPairs) {
    if (key.trim()) env[key.trim()] = value;
  }
  return {
    name: form.name.trim(),
    type: form.type,
    path: form.path.trim(),
    port: form.port ? parseInt(form.port, 10) : null,
    https: form.https,
    externalUrl: form.externalUrl.trim() || null,
    tags: form.tags,
    env,
    runCommand: form.runCommand.trim(),
    buildCommand: form.buildCommand.trim() || null,
  };
}

function projectToForm(p: ProjectConfig): ProjectForm {
  return {
    name: p.name,
    type: p.type,
    path: p.path,
    port: p.port != null ? String(p.port) : '',
    https: p.https,
    externalUrl: p.externalUrl ?? '',
    tags: p.tags,
    runCommand: p.runCommand,
    buildCommand: p.buildCommand ?? '',
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
        <span>Path</span>
        <div className="pf-row">
          <input type="text" value={form.path} onChange={setStr('path')} placeholder="/path/to/project" />
          <button type="button" className="btn ghost" onClick={onBrowse}>Browse…</button>
        </div>
      </label>

      <div className="pf-field">
        <span>Protocol</span>
        <div className="pf-protocol">
          <label className="pf-protocol-opt">
            <input type="radio" checked={!form.https} onChange={() => set('https', false)} />
            HTTP
          </label>
          <label className="pf-protocol-opt">
            <input type="radio" checked={form.https} onChange={() => set('https', true)} />
            HTTPS
          </label>
        </div>
      </div>

      <label className="pf-field">
        <span>Port</span>
        <input type="number" value={form.port} onChange={setStr('port')} placeholder="e.g. 5001" min="1" max="65535" />
      </label>

      <label className="pf-field">
        <span>External URL <small>(optional)</small></span>
        <input type="text" value={form.externalUrl} onChange={setStr('externalUrl')} placeholder="e.g. https://myapp.ngrok.io" />
      </label>

      <label className="pf-field">
        <span>Run command</span>
        <input type="text" value={form.runCommand} onChange={setStr('runCommand')} placeholder="e.g. dotnet run --launch-profile Development" className="pf-mono" />
      </label>

      <label className="pf-field">
        <span>Build command <small>(optional)</small></span>
        <input type="text" value={form.buildCommand} onChange={setStr('buildCommand')} placeholder="e.g. dotnet build" className="pf-mono" />
      </label>

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

// ─── Profile panel ───────────────────────────────────────────────────────────

type ProfileForm = { name: string; runCommand: string; port: string; https: boolean; externalUrl: string };
const EMPTY_PROFILE_FORM: ProfileForm = { name: '', runCommand: '', port: '', https: false, externalUrl: '' };

function ProfilesPanel({ projectId, projectRunCommand }: { projectId: string; projectRunCommand: string }) {
  const [list, setList] = useState<RunProfile[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>(EMPTY_PROFILE_FORM);

  const load = useCallback(async () => {
    setList(await window.launcher.listProfiles(projectId));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const startAdd = () => {
    setForm({ ...EMPTY_PROFILE_FORM, runCommand: projectRunCommand });
    setAdding(true);
    setEditingId(null);
  };

  const startEdit = (p: RunProfile) => {
    setForm({ name: p.name, runCommand: p.runCommand, port: p.port != null ? String(p.port) : '', https: p.https, externalUrl: p.externalUrl ?? '' });
    setEditingId(p.id);
    setAdding(false);
  };

  const save = async () => {
    if (!form.name.trim() || !form.runCommand.trim()) return;
    const port = form.port ? parseInt(form.port, 10) : null;
    const externalUrl = form.externalUrl.trim() || null;
    if (editingId) {
      await window.launcher.updateProfile(editingId, {
        name: form.name.trim(), runCommand: form.runCommand.trim(), port, https: form.https, externalUrl,
      });
    } else {
      const input: RunProfileCreateInput = {
        projectId, name: form.name.trim(), runCommand: form.runCommand.trim(), port, https: form.https, externalUrl,
      };
      await window.launcher.createProfile(input);
    }
    setAdding(false);
    setEditingId(null);
    load();
  };

  const cancel = () => { setAdding(false); setEditingId(null); };

  const del = async (id: string) => {
    if (!confirm('Delete this profile?')) return;
    await window.launcher.deleteProfile(id);
    load();
  };

  const showForm = adding || editingId !== null;

  return (
    <div className="pf-profiles-section">
      <div className="pf-profiles-header">
        <span>Run Profiles</span>
        {!showForm && (
          <button type="button" className="btn ghost pf-env-add" onClick={startAdd}>+ Add</button>
        )}
      </div>

      {list.length === 0 && !showForm && (
        <span className="pf-env-empty">No profiles — Default run command is used</span>
      )}

      {list.map((p) => (
        editingId === p.id ? (
          <ProfileInlineForm key={p.id} form={form} onChange={setForm} onSave={save} onCancel={cancel} />
        ) : (
          <div key={p.id} className="pf-profile-row">
            <div className="pf-profile-info">
              <span className="pf-profile-name">{p.name}</span>
              <span className="pf-profile-proto">{p.https ? 'https' : 'http'}</span>
              {p.port != null && <span className="pf-profile-port">:{p.port}</span>}
              <span className="pf-profile-cmd pf-mono" title={p.runCommand}>{p.runCommand}</span>
            </div>
            <div className="pf-profile-btns">
              <button type="button" className="btn ghost" onClick={() => startEdit(p)} title="Edit">✎</button>
              <button type="button" className="btn ghost wm-project-del" onClick={() => del(p.id)} title="Delete">✕</button>
            </div>
          </div>
        )
      ))}

      {adding && (
        <ProfileInlineForm form={form} onChange={setForm} onSave={save} onCancel={cancel} />
      )}
    </div>
  );
}

function ProfileInlineForm({
  form, onChange, onSave, onCancel,
}: {
  form: ProfileForm;
  onChange: (f: ProfileForm) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const setStr = (k: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...form, [k]: e.target.value });
  return (
    <div className="pf-profile-form">
      <input
        type="text"
        placeholder="Profile name (e.g. Staging)"
        value={form.name}
        autoFocus
        onChange={setStr('name')}
        onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
      />
      <input
        type="text"
        placeholder="Run command"
        value={form.runCommand}
        className="pf-mono"
        onChange={setStr('runCommand')}
        onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
      />
      <div className="pf-protocol">
        <label className="pf-protocol-opt">
          <input type="radio" checked={!form.https} onChange={() => onChange({ ...form, https: false })} />
          HTTP
        </label>
        <label className="pf-protocol-opt">
          <input type="radio" checked={form.https} onChange={() => onChange({ ...form, https: true })} />
          HTTPS
        </label>
      </div>
      <input
        type="number"
        placeholder="Port (optional)"
        value={form.port}
        min="1"
        max="65535"
        onChange={setStr('port')}
        onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
      />
      <input
        type="text"
        placeholder="External URL (optional)"
        value={form.externalUrl}
        onChange={setStr('externalUrl')}
        onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
      />
      <div className="pf-profile-form-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn primary" onClick={onSave}
          disabled={!form.name.trim() || !form.runCommand.trim()}>Save</button>
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

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

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

  const startCreateProject = async () => {
    if (!selectedWsId) return;
    const defaults = await window.launcher.getProjectTypeDefaults('dotnet');
    setProjectForm({ ...EMPTY_FORM, runCommand: defaults.runCommand });
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

  const handleTypeChange = async (type: ProjectType) => {
    const defaults = await window.launcher.getProjectTypeDefaults(type);
    setProjectForm((f) => ({
      ...f,
      type,
      runCommand: f.runCommand === '' || !f.runCommand ? defaults.runCommand : f.runCommand,
      port: f.port === '' && defaults.port != null ? String(defaults.port) : f.port,
    }));
  };

  const browseProjectPath = async () => {
    const picked = await window.launcher.pickDirectory({
      defaultPath: projectForm.path || undefined,
      title: 'Select project folder',
    });
    if (picked) setProjectForm((f) => ({ ...f, path: picked }));
  };

  const saveProject = async () => {
    if (!projectForm.name.trim()) { setError('Name is required'); return; }
    if (!projectForm.path.trim()) { setError('Path is required'); return; }
    if (!projectForm.runCommand.trim()) { setError('Run command is required'); return; }
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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
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

                    {editingProject.mode === 'edit' && (
                      <ProfilesPanel
                        projectId={editingProject.project.id}
                        projectRunCommand={projectForm.runCommand}
                      />
                    )}

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
