import * as React from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { enterpriseControlFocusClass } from '@/lib/enterpriseButtonClasses'
import { cn } from '@/lib/utils'

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  children: React.ReactNode
  onChange?: React.ChangeEventHandler<HTMLSelectElement>
}

type ParsedOption = {
  value: string
  label: React.ReactNode
  disabled?: boolean
  isPlaceholder?: boolean
}

function isOptionElement(child: React.ReactElement): boolean {
  if (child.type === 'option') return true
  if (typeof child.type === 'function') {
    const named = child.type as { displayName?: string }
    return named.displayName === 'SelectItem'
  }
  return false
}

function parseSelectChildren(children: React.ReactNode): {
  placeholder?: string
  options: ParsedOption[]
} {
  const options: ParsedOption[] = []
  let placeholder: string | undefined

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child) || !isOptionElement(child)) return
    const props = child.props as {
      value?: string | number
      disabled?: boolean
      children?: React.ReactNode
    }
    const value = props.value === undefined || props.value === null ? '' : String(props.value)
    const label = props.children ?? value
    const isPlaceholder = value === '' && props.disabled

    if (isPlaceholder) {
      placeholder = typeof label === 'string' ? label : String(label)
      return
    }

    options.push({
      value,
      label,
      disabled: props.disabled,
    })
  })

  return { placeholder, options }
}

function emitSelectChange(
  onChange: SelectProps['onChange'],
  nextValue: string,
  name?: string,
) {
  if (!onChange) return
  const target = { value: nextValue, name: name ?? '' } as HTMLSelectElement
  onChange({ target, currentTarget: target } as React.ChangeEvent<HTMLSelectElement>)
}

const SELECT_LAYOUT_CLASS_RE = /^(?:w-|min-w-|max-w-|shrink-|grow-|basis-)/

function sanitizeAutoName(id: string): string {
  return id.replace(/:/g, '')
}

function splitSelectLayoutClasses(className?: string): { container: string; trigger: string } {
  if (!className) {
    return { container: 'w-full', trigger: '' }
  }
  const tokens = className.split(/\s+/).filter(Boolean)
  const layout = tokens.filter((token) => SELECT_LAYOUT_CLASS_RE.test(token))
  const visual = tokens.filter((token) => !SELECT_LAYOUT_CLASS_RE.test(token))
  return {
    container: cn('min-w-0', layout.length > 0 ? layout.join(' ') : 'w-full'),
    trigger: visual.join(' '),
  }
}

const nativeSelectClassName = (className?: string, disabled?: boolean) =>
  cn(
    'flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm',
    'transition-[border-color,box-shadow,background-color] duration-150',
    enterpriseControlFocusClass(),
    'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-0',
    disabled && 'cursor-not-allowed opacity-50',
    className,
  )

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, value, defaultValue, onChange, disabled, id, name, multiple, ...props }, ref) => {
    const autoId = React.useId()
    const resolvedId = id ?? autoId
    const resolvedName = name ?? sanitizeAutoName(resolvedId)

    if (multiple) {
      const isControlled = value !== undefined
      const controlledValue = Array.isArray(value)
        ? value.map(String)
        : value == null
          ? []
          : [String(value)]

      return (
        <select
          ref={ref}
          id={resolvedId}
          name={resolvedName}
          multiple
          value={isControlled ? controlledValue : undefined}
          defaultValue={
            !isControlled && defaultValue !== undefined
              ? Array.isArray(defaultValue)
                ? defaultValue.map(String)
                : [String(defaultValue)]
              : undefined
          }
          disabled={disabled}
          onChange={onChange}
          className={nativeSelectClassName(className, disabled)}
          {...props}
        >
          {children}
        </select>
      )
    }

    const containerRef = React.useRef<HTMLDivElement>(null)
    const triggerRef = React.useRef<HTMLButtonElement>(null)
    const menuRef = React.useRef<HTMLDivElement>(null)
    const hiddenSelectRef = React.useRef<HTMLSelectElement>(null)
    const [open, setOpen] = React.useState(false)
    const [mounted, setMounted] = React.useState(false)
    const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties>({})
    const [highlightIndex, setHighlightIndex] = React.useState(-1)

    const isControlled = value !== undefined
    const [internalValue, setInternalValue] = React.useState(
      defaultValue !== undefined ? String(defaultValue) : '',
    )
    const currentValue = isControlled ? String(value ?? '') : internalValue

    const { placeholder, options } = React.useMemo(() => parseSelectChildren(children), [children])
    const enabledOptions = React.useMemo(
      () => options.filter((opt) => !opt.disabled),
      [options],
    )
    const selectedOption = options.find((opt) => opt.value === currentValue)

    const { container: containerLayoutClass, trigger: triggerClassName } = splitSelectLayoutClasses(className)

    React.useImperativeHandle(ref, () => hiddenSelectRef.current as HTMLSelectElement)

    const updateMenuPosition = React.useCallback(() => {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const viewportPadding = 8
      const maxHeight = 280
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding
      const spaceAbove = rect.top - viewportPadding
      const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow
      const available = openUpward ? spaceAbove : spaceBelow
      const height = Math.min(maxHeight, Math.max(120, available))

      setMenuStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        maxHeight: height,
        ...(openUpward
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.top + rect.height + 4 }),
      })
    }, [])

    React.useEffect(() => {
      setMounted(true)
    }, [])

    React.useEffect(() => {
      if (!open) return
      updateMenuPosition()
      const onScrollOrResize = () => updateMenuPosition()
      window.addEventListener('resize', onScrollOrResize)
      window.addEventListener('scroll', onScrollOrResize, true)
      return () => {
        window.removeEventListener('resize', onScrollOrResize)
        window.removeEventListener('scroll', onScrollOrResize, true)
      }
    }, [open, updateMenuPosition])

    React.useEffect(() => {
      if (!open) return
      const onPointerDown = (event: MouseEvent) => {
        const target = event.target as Node
        if (containerRef.current?.contains(target)) return
        if (triggerRef.current?.contains(target)) return
        if (menuRef.current?.contains(target)) return
        setOpen(false)
      }
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') setOpen(false)
      }
      document.addEventListener('mousedown', onPointerDown)
      document.addEventListener('keydown', onKeyDown)
      return () => {
        document.removeEventListener('mousedown', onPointerDown)
        document.removeEventListener('keydown', onKeyDown)
      }
    }, [open])

    React.useEffect(() => {
      if (!open) {
        setHighlightIndex((prev) => (prev === -1 ? prev : -1))
        return
      }
      const selectedIndex = enabledOptions.findIndex((opt) => opt.value === currentValue)
      const nextIndex = selectedIndex >= 0 ? selectedIndex : 0
      setHighlightIndex((prev) => (prev === nextIndex ? prev : nextIndex))
    }, [open, currentValue, enabledOptions])

    const commitValue = (nextValue: string) => {
      if (!isControlled) setInternalValue(nextValue)
      if (hiddenSelectRef.current) hiddenSelectRef.current.value = nextValue
      emitSelectChange(onChange, nextValue, resolvedName)
      setOpen(false)
    }

    const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return
      if (event.key === ' ') {
        event.preventDefault()
        setOpen((prev) => !prev)
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        if (open && highlightIndex >= 0) {
          const opt = enabledOptions[highlightIndex]
          if (opt) commitValue(opt.value)
        } else {
          setOpen(true)
        }
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (!open) {
          setOpen(true)
          return
        }
        setHighlightIndex((prev) => {
          const next = prev + 1
          return next >= enabledOptions.length ? 0 : next
        })
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (!open) {
          setOpen(true)
          return
        }
        setHighlightIndex((prev) => {
          const next = prev - 1
          return next < 0 ? enabledOptions.length - 1 : next
        })
      }
    }

    const triggerLabel =
      selectedOption?.label
      ?? (currentValue ? currentValue : placeholder ?? 'Select…')

    const menu =
      open && mounted
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              aria-labelledby={resolvedId}
              style={menuStyle}
              className={cn(
                'overflow-hidden rounded-xl border border-border/60 bg-popover/95 shadow-[0_16px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl',
                'animate-in fade-in-0 zoom-in-95 duration-150',
              )}
            >
              <div className="max-h-[inherit] overflow-y-auto overscroll-contain p-1.5">
                {options.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No options</div>
                ) : (
                  options.map((option) => {
                    const enabledIndex = enabledOptions.indexOf(option)
                    const isSelected = option.value === currentValue
                    const isHighlighted = enabledIndex === highlightIndex
                    return (
                      <button
                        key={`${option.value}-${String(option.label)}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={option.disabled}
                        onMouseEnter={() => {
                          if (enabledIndex >= 0) setHighlightIndex(enabledIndex)
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault()
                        }}
                        onClick={() => {
                          if (option.disabled) return
                          commitValue(option.value)
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                          option.disabled && 'cursor-not-allowed opacity-50',
                          !option.disabled && (isSelected || isHighlighted)
                            ? 'bg-primary/10 text-foreground'
                            : !option.disabled && 'text-foreground hover:bg-muted/80',
                        )}
                      >
                        <Check
                          className={cn(
                            'h-4 w-4 shrink-0 text-primary',
                            isSelected ? 'opacity-100' : 'opacity-0',
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>,
            document.body,
          )
        : null

    return (
      <div ref={containerRef} className={cn('relative', containerLayoutClass)}>
        <select
          ref={hiddenSelectRef}
          id={resolvedId}
          name={resolvedName}
          value={currentValue}
          disabled={disabled}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={onChange}
          {...props}
        >
          {children}
        </select>

        <button
          ref={triggerRef}
          type="button"
          id={resolvedId ? `${resolvedId}-trigger` : undefined}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            if (disabled) return
            setOpen((prev) => !prev)
          }}
          onKeyDown={onTriggerKeyDown}
          className={cn(
            'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm',
            'transition-[border-color,box-shadow,background-color] duration-150',
            enterpriseControlFocusClass(),
            'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-0',
            open && 'border-ring ring-2 ring-ring/20',
            disabled && 'cursor-not-allowed opacity-50',
            triggerClassName,
          )}
        >
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-left',
              !selectedOption && !currentValue && 'text-muted-foreground',
            )}
          >
            {triggerLabel}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </button>

        {menu}
      </div>
    )
  },
)
Select.displayName = 'Select'

const SelectTrigger = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => {
    return <Select ref={ref} className={className} {...props} />
  },
)
SelectTrigger.displayName = 'SelectTrigger'

const SelectValue = ({ placeholder }: { placeholder?: string }) => {
  return (
    <option value="" disabled>
      {placeholder || 'Select…'}
    </option>
  )
}

const SelectContent = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

const SelectItem = React.forwardRef<
  HTMLOptionElement,
  React.OptionHTMLAttributes<HTMLOptionElement>
>(({ className, children, ...props }, ref) => {
  return (
    <option ref={ref} className={className} {...props}>
      {children}
    </option>
  )
})
SelectItem.displayName = 'SelectItem'

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
