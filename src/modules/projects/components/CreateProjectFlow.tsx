import { useEffect, useState } from 'react'
import { CreateProjectModal } from './CreateProjectModal'
import { ProjectTemplatePicker } from './ProjectTemplatePicker'
import {
  DEFAULT_PROJECT_TEMPLATE_CATEGORY_ID,
  type ProjectTemplate,
  type ProjectTemplateCategoryId,
} from '../data/projectTemplates'

type CreateProjectFlowStep = 'catalog' | 'detail' | 'form'

interface CreateProjectFlowProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  autoNavigate?: boolean
  onProjectCreated?: (projectId: string) => void
  initialFolderId?: string | null
}

export function CreateProjectFlow({
  open,
  onOpenChange,
  autoNavigate = true,
  onProjectCreated,
  initialFolderId = null,
}: CreateProjectFlowProps) {
  const [step, setStep] = useState<CreateProjectFlowStep>('catalog')
  const [categoryId, setCategoryId] = useState<ProjectTemplateCategoryId>(DEFAULT_PROJECT_TEMPLATE_CATEGORY_ID)
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null)

  useEffect(() => {
    if (open) return
    setStep('catalog')
    setCategoryId(DEFAULT_PROJECT_TEMPLATE_CATEGORY_ID)
    setSelectedTemplate(null)
  }, [open])

  const handleClose = () => onOpenChange(false)

  const showPicker = open && (step === 'catalog' || step === 'detail')
  const showForm = open && step === 'form' && selectedTemplate

  return (
    <>
      <ProjectTemplatePicker
        open={showPicker}
        step={step === 'detail' ? 'detail' : 'catalog'}
        categoryId={categoryId}
        selectedTemplate={selectedTemplate}
        onCategoryChange={setCategoryId}
        onSelectTemplate={(template) => {
          setSelectedTemplate(template)
          setCategoryId(template.categoryId)
          setStep('detail')
        }}
        onBackToCatalog={() => setStep('catalog')}
        onUseTemplate={() => setStep('form')}
        onClose={handleClose}
      />

      {showForm && selectedTemplate ? (
        <CreateProjectModal
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) handleClose()
          }}
          autoNavigate={autoNavigate}
          onProjectCreated={onProjectCreated}
          initialFolderId={initialFolderId}
          selectedTemplate={selectedTemplate}
          onChangeTemplate={() => setStep('detail')}
        />
      ) : null}
    </>
  )
}
