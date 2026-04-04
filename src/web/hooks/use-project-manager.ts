import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from './use-project';

interface UseProjectManagerOptions {
  projectId: string;
}

export function useProjectManager({ projectId }: UseProjectManagerOptions) {
  const navigate = useNavigate();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();

  const currentProject = useMemo(() => 
    projects.find(p => p.id === projectId),
    [projects, projectId]
  );

  const handleProjectChange = useCallback((newProjectId: string) => {
    navigate(`/dashboard/agent/${newProjectId}`);
  }, [navigate]);

  return {
    projects,
    projectsLoading,
    currentProject,
    handleProjectChange,
  };
}
