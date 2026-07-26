// Module: Projects
// Export public APIs used by Project list workspace

export { ProjectListPage } from './pages/ProjectListPage'
export { ProjectDetailPage } from './pages/ProjectDetailPage'

export { CreateProjectFlow } from './components/CreateProjectFlow'
export { CreateProjectModal } from './components/CreateProjectModal'
export { CreateFolderModal } from './components/CreateFolderModal'
export { FoldersSection } from './components/FoldersSection'
export { ProjectsSection } from './components/ProjectsSection'

export { useProjectStore } from './store/projectStore'
export type { Project, ProjectStatus } from './store/projectStore'

export { useFolderStore } from './store/folderStore'
export type { Folder } from './store/folderStore'
