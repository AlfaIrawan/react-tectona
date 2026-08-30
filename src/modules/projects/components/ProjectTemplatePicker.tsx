import { useEffect } from 'react'
import {
  ArrowLeft,
  LayoutGrid,
  X,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { enterpriseCyanGradientActionButtonClass } from '@/lib/enterpriseButtonClasses'
import {
  DEFAULT_PROJECT_TEMPLATE_CATEGORY_ID,
  PROJECT_TEMPLATE_CATEGORIES,
  getProjectTemplateCategory,
  getProjectTemplatesByCategory,
  type ProjectTemplate,
  type ProjectTemplateBadge,
  type ProjectTemplateCategoryId,
  type ProjectTemplateFeature,
  type ProjectTemplateWorkType,
} from '../data/projectTemplates'

type PickerStep = 'catalog' | 'detail'

interface ProjectTemplatePickerProps {
  open: boolean
  step: PickerStep
  categoryId: ProjectTemplateCategoryId
  selectedTemplate: ProjectTemplate | null
  onCategoryChange: (categoryId: ProjectTemplateCategoryId) => void
  onSelectTemplate: (template: ProjectTemplate) => void
  onBackToCatalog: () => void
  onUseTemplate: () => void
  onClose: () => void
}

const WORK_TYPE_SQUARE_CLASS: Record<ProjectTemplateWorkType['tone'], string> = {
  violet: 'bg-violet-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  sky: 'bg-sky-500',
  cyan: 'bg-cyan-400',
}

function TemplateBadge({ badge }: { badge: ProjectTemplateBadge }) {
  if (badge === 'recommended') {
    return (
      <span className="rounded-md bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        Recommended
      </span>
    )
  }
  return (
    <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 dark:bg-slate-700 dark:text-slate-100">
      Premium
    </span>
  )
}

function TemplateCardArt({ imageSrc, alt }: { imageSrc: string; alt: string }) {
  return (
    <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-t-xl border-b border-border/60 bg-muted/20 px-3 py-2">
      <img
        src={imageSrc}
        alt={alt}
        className="max-h-full max-w-full object-contain"
        loading="lazy"
      />
    </div>
  )
}

function TemplateFeatureArt({
  feature,
  thumbnailImage,
  templateName,
}: {
  feature: ProjectTemplateFeature
  thumbnailImage: string
  templateName: string
}) {
  const imageSrc = feature.imageSrc ?? thumbnailImage

  return (
    <img
      src={imageSrc}
      alt={`${templateName} — ${feature.title}`}
      className="h-full w-full object-contain object-center"
      loading="lazy"
    />
  )
}

function TemplateFeatureRow({
  feature,
  index,
  thumbnailImage,
  templateName,
}: {
  feature: ProjectTemplateFeature
  index: number
  thumbnailImage: string
  templateName: string
}) {
  const imageFirst = index % 2 === 0

  const artPanel = (
    <div className="relative aspect-[5/4] w-full overflow-hidden rounded-xl bg-muted/10 p-3 sm:p-4">
      <TemplateFeatureArt feature={feature} thumbnailImage={thumbnailImage} templateName={templateName} />
    </div>
  )

  const textPanel = (
    <div className="flex flex-col justify-center px-0 md:px-1 lg:px-3">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{feature.title}</h2>
      <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-[15px] md:leading-8">{feature.body}</p>
      {feature.learnMoreLabel ? (
        <button type="button" className="mt-4 w-fit text-sm font-medium text-primary hover:underline">
          {feature.learnMoreLabel}
        </button>
      ) : null}
    </div>
  )

  return (
    <section className="grid gap-6 md:grid-cols-2 md:items-center md:gap-8 lg:gap-10">
      {imageFirst ? (
        <>
          {artPanel}
          {textPanel}
        </>
      ) : (
        <>
          <div className="md:order-1">{textPanel}</div>
          <div className="md:order-2">{artPanel}</div>
        </>
      )}
    </section>
  )
}

function TemplateDetailSidebar({ template }: { template: ProjectTemplate }) {
  return (
    <aside className="space-y-8 lg:sticky lg:top-6 lg:self-start">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product</h3>
        <div className="mt-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <LayoutGrid className="h-4 w-4" />
          </span>
          Tectona
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended for</h3>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{template.recommendedFor.join(' ')}</p>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Work types</h3>
        <ul className="mt-3 space-y-2.5">
          {template.workTypes.map((workType) => (
            <li key={workType.label} className="flex items-center gap-2.5 text-sm text-foreground">
              <span className={cn('h-4 w-4 shrink-0 rounded-[3px]', WORK_TYPE_SQUARE_CLASS[workType.tone])} />
              {workType.label}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workflow</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {template.workflow.map((stage, index) => (
            <span
              key={stage}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
                index === 0
                  ? 'bg-slate-200 text-slate-700'
                  : index === template.workflow.length - 1
                    ? 'bg-emerald-500/15 text-emerald-700'
                    : 'bg-sky-500/15 text-sky-700'
              )}
            >
              {stage}
            </span>
          ))}
        </div>
      </section>
    </aside>
  )
}

export function ProjectTemplatePicker({
  open,
  step,
  categoryId,
  selectedTemplate,
  onCategoryChange,
  onSelectTemplate,
  onBackToCatalog,
  onUseTemplate,
  onClose,
}: ProjectTemplatePickerProps) {
  const activeCategory = getProjectTemplateCategory(categoryId)
  const templates = getProjectTemplatesByCategory(categoryId)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[1190] bg-black/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="fixed inset-0 z-[1200] flex h-[100dvh] w-screen flex-col bg-background"
        role="dialog"
        aria-modal="true"
        aria-label={step === 'catalog' ? 'Choose project template' : 'Project template details'}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 z-10 md:right-3 md:top-3"
          onClick={onClose}
          aria-label="Close template picker"
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="flex min-h-0 flex-1 pt-0">
          <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-muted/20 md:flex">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Project templates</h2>
            </div>
            <nav className="flex-1 overflow-y-auto p-2">
              {PROJECT_TEMPLATE_CATEGORIES.map((category) => {
                const active = category.id === categoryId
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      onCategoryChange(category.id)
                      if (step === 'detail') onBackToCatalog()
                    }}
                    className={cn(
                      'mb-0.5 flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      active
                        ? 'bg-primary/10 font-semibold text-primary'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                  >
                    {category.label}
                  </button>
                )
              })}
            </nav>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {step === 'catalog' ? (
              <>
                <div className="shrink-0 border-b border-border/70 px-4 py-4 md:px-8">
                  <div className="min-w-0 pr-10">
                    <div className="mb-3 md:hidden">
                        <label className="sr-only" htmlFor="template-category-mobile">
                          Template category
                        </label>
                        <select
                          id="template-category-mobile"
                          value={categoryId}
                          onChange={(event) => {
                            onCategoryChange(event.target.value as ProjectTemplateCategoryId)
                          }}
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {PROJECT_TEMPLATE_CATEGORIES.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                        {activeCategory?.label ?? 'Templates'}
                      </h1>
                      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                        {activeCategory?.description}
                      </p>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-8">
                  {templates.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {templates.map((template) => {
                        const isAvailable = template.id === 'kanban'
                        return (
                          <button
                            key={template.id}
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => {
                              if (!isAvailable) return
                              onSelectTemplate(template)
                            }}
                            aria-disabled={!isAvailable}
                            title={isAvailable ? undefined : 'Coming soon'}
                            className={cn(
                              'group overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-all',
                              isAvailable
                                ? 'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md'
                                : 'cursor-not-allowed opacity-50 grayscale'
                            )}
                          >
                            <TemplateCardArt
                              imageSrc={template.thumbnailImage}
                              alt={`${template.name} template preview`}
                            />
                            <div className="space-y-2 p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-foreground">{template.name}</h3>
                                {template.badge ? <TemplateBadge badge={template.badge} /> : null}
                                {isAvailable ? null : (
                                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                    Coming soon
                                  </span>
                                )}
                              </div>
                              <p className="line-clamp-2 text-sm text-muted-foreground">{template.summary}</p>
                              <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                                <LayoutGrid className="h-3.5 w-3.5" />
                                <span>Tectona</span>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
                      <p className="text-sm font-medium text-foreground">No templates in this category yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Choose another category or start from Software development.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-4"
                        onClick={() => onCategoryChange(DEFAULT_PROJECT_TEMPLATE_CATEGORY_ID)}
                      >
                        Browse software development
                      </Button>
                    </div>
                  )}
                </div>
              </>
            ) : selectedTemplate ? (
              <>
                <div className="flex shrink-0 items-center border-b border-border px-4 py-3 md:px-8">
                  <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onBackToCatalog}>
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
                  <header className="max-w-3xl pr-10">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                        {selectedTemplate.name}
                      </h1>
                      {selectedTemplate.badge ? <TemplateBadge badge={selectedTemplate.badge} /> : null}
                    </div>
                    <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base md:leading-8">
                      {selectedTemplate.summary}
                    </p>
                  </header>

                  <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="space-y-10 md:space-y-12">
                      {selectedTemplate.features.map((feature, index) => (
                        <TemplateFeatureRow
                          key={feature.title}
                          feature={feature}
                          index={index}
                          thumbnailImage={selectedTemplate.thumbnailImage}
                          templateName={selectedTemplate.name}
                        />
                      ))}
                    </div>

                    <TemplateDetailSidebar template={selectedTemplate} />
                  </div>
                </div>

                <div className="shrink-0 border-t border-border bg-background px-4 py-4 md:px-8">
                  <div className="flex justify-end">
                    <button type="button" className={enterpriseCyanGradientActionButtonClass()} onClick={onUseTemplate}>
                      Use template
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
