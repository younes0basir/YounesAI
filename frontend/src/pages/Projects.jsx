import { useState } from 'react';
import { FolderKanban, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProjects, useCreateProject } from '../hooks/useProjects';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';

export default function Projects() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { data, isLoading, isError, refetch } = useProjects();
  const create = useCreateProject();

  const projects = Array.isArray(data) ? data : [];

  const onCreate = async () => {
    if (!name.trim()) return;
    await create.mutateAsync({ name: name.trim(), description: description.trim() || null });
    setName('');
    setDescription('');
    setShowForm(false);
    toast.success('Project created');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Projects"
        description="Group tasks and collaborate with shared workspaces."
        action={
          <button onClick={() => setShowForm((v) => !v)} className="btn btn-primary">
            <Plus size={16} /> {showForm ? 'Close' : 'New project'}
          </button>
        }
      />

      {showForm ? (
        <div className="surface-elevated p-5 space-y-3 animate-fade-up">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Project name"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="textarea"
            rows={2}
            placeholder="Description (optional)"
          />
          <button onClick={onCreate} className="btn btn-primary">
            Create project
          </button>
        </div>
      ) : null}

      {isError ? (
        <ErrorState title="Could not load projects" onRetry={refetch} />
      ) : isLoading ? (
        <LoadingState message="Loading projects..." />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create a project to organize related tasks."
          action={
            <button onClick={() => setShowForm(true)} className="btn btn-primary text-sm">
              New project
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <div key={p.id} className="surface surface-interactive p-5">
              <div className="flex items-start gap-3">
                <div className="nav-icon bg-violet-100 text-violet-600">
                  <FolderKanban size={16} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900">{p.name}</h3>
                  {p.description ? (
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{p.description}</p>
                  ) : null}
                  <span
                    className={`badge mt-3 ${p.status === 'archived' ? 'badge-muted' : 'badge-done'}`}
                  >
                    {p.status || 'active'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
