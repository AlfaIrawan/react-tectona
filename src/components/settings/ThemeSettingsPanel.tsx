import { useState, useEffect } from 'react'
import { useThemeStore } from '@/stores/theme-store'
import { usePreferencesStore } from '@/stores/preferences-store'
import { TECTONA_THEMES, normalizeAccent, type AccentColor } from '@/lib/tectonaThemes'
import { updateAnimationSpeed, initializeAnimationSpeed } from '@/lib/animationUtils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import {
  Palette,
  Layout,
  EyeOff,
  Layers,
  PanelLeft,
  Maximize,
  Home,
  Folder
} from 'lucide-react'

const ThemeSettingsPanel = () => {
  const { setTheme } = useThemeStore()
  const { preferences, updatePreferences } = usePreferencesStore()
  const [fontSize, setFontSize] = useState(preferences?.fontSize || 14)
  const [animationSpeed, setAnimationSpeed] = useState(preferences?.animationSpeed || 300)
  const [systemMotionReduced, setSystemMotionReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setSystemMotionReduced(query.matches)
    update(); query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  // Initialize animation speed on a mount
  useEffect(() => {
    if (preferences?.animationSpeed) {
      initializeAnimationSpeed(preferences.animationSpeed)
    }
  }, [preferences.animationSpeed])

  // Accent choice (default theme)
  const currentAccentChoice = normalizeAccent(preferences?.accentColor)

  // Handle accent choice change
  const handleAccentChoiceChange = (choice: AccentColor) => {
    updatePreferences({ accentColor: choice })
  }

  // Handle font size change
  const handleFontSizeChange = (value: number[]) => {
    const newSize = value[0]
    setFontSize(newSize)
    updatePreferences({ fontSize: newSize })
    document.documentElement.style.fontSize = `${newSize}px`
  }

  // Handle animation speed change
  const handleAnimationSpeedChange = (value: number[]) => {
    const newSpeed = value[0]
    setAnimationSpeed(newSpeed)
    updatePreferences({ animationSpeed: newSpeed })
    updateAnimationSpeed(newSpeed)
  }

  // Handle toggle changes
  const handleToggleChange = (key: string, value: boolean) => {
    updatePreferences({ [key]: value } as never)
  }

  const [activeTab, setActiveTab] = useState('theme')

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="theme">Theme</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
        </TabsList>

        {/* Theme Tab */}
        <TabsContent value="theme" className="space-y-6">
          {/* Tectona Gray-to-Blue theme family; Default keeps its original media. */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Tectona Themes</h3>
            <p className="text-xs text-muted-foreground">Choose a cinematic palette and background. Default stays unchanged.</p>
            {(systemMotionReduced || preferences.reduceAnimations || preferences.highContrast) && (
              <p role="status" className="rounded-md border border-border bg-muted p-2 text-xs text-muted-foreground">
                Background video is paused. {systemMotionReduced ? 'Your device has Reduce Motion enabled.' : preferences.reduceAnimations ? 'Reduce Animations is enabled in Behavior.' : 'High Contrast is enabled in Behavior.'} A static poster is shown instead.
              </p>
            )}
            <div className="theme-swatch-grid grid grid-cols-2 gap-2">
              {TECTONA_THEMES.map(theme => (
                <Button
                  key={theme.id}
                  variant="outline"
                  aria-pressed={currentAccentChoice === theme.id}
                  className={`tectona-theme-option h-auto min-h-24 flex flex-col items-start justify-center p-3 text-left whitespace-normal ${currentAccentChoice === theme.id ? 'border-primary ring-1 ring-primary bg-accent' : ''}`}
                  onClick={() => handleAccentChoiceChange(theme.id)}
                >
                  <span
                    className="theme-swatch-sphere mb-2 block h-9 w-9 shrink-0 rounded-full border border-black/10"
                    style={{
                      backgroundImage: `radial-gradient(circle at 28% 22%, rgba(255,255,255,.85), rgba(255,255,255,.12) 35%, transparent 58%), radial-gradient(circle at 70% 80%, rgba(0,0,0,.25), transparent 65%), ${theme.swatch}`,
                      boxShadow: 'inset 0 1px 2px rgba(255,255,255,.7), inset -3px -4px 6px rgba(0,0,0,.16), 0 2px 4px rgba(0,0,0,.12)',
                    }}
                    aria-hidden
                  />
                  <span className="text-xs font-semibold">{theme.label}</span>
                  <span className="mt-1 text-[10px] text-muted-foreground">{theme.description}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="font-size">Font Size</Label>
              <span className="text-sm text-muted-foreground">{fontSize}px</span>
            </div>
            <Slider
              id="font-size"
              min={12}
              max={20}
              step={1}
              value={[fontSize]}
              onValueChange={handleFontSizeChange}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Small</span>
              <span>Large</span>
            </div>
          </div>

          {/* Animation Speed */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="animation-speed">Animation Speed</Label>
              <span className="text-sm text-muted-foreground">{animationSpeed}ms</span>
            </div>
            <Slider
              id="animation-speed"
              min={100}
              max={500}
              step={50}
              value={[animationSpeed]}
              onValueChange={handleAnimationSpeedChange}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Fast</span>
              <span>Slow</span>
            </div>
          </div>
        </TabsContent>

        {/* Layout Tab */}
        <TabsContent value="layout" className="space-y-6">
          {/* Sidebar Options */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Sidebar</h3>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <PanelLeft className="h-4 w-4" />
                <Label htmlFor="sidebar-fixed">Fixed Sidebar</Label>
              </div>
              <Switch
                id="sidebar-fixed"
                checked={!(preferences?.sidebarFixed ?? false)}
                onCheckedChange={(checked) => handleToggleChange('sidebarFixed', !checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="h-4 w-4" />
                <Label htmlFor="sidebar-mini">Mini Sidebar on Collapse</Label>
              </div>
              <Switch
                id="sidebar-mini"
                checked={preferences?.sidebarMini ?? true}
                onCheckedChange={(checked) => handleToggleChange('sidebarMini', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layout className="h-4 w-4" />
                <Label htmlFor="enterprise-nav-titles-only">Enterprise Nav: Titles Only</Label>
              </div>
              <Switch
                id="enterprise-nav-titles-only"
                checked={preferences?.enterpriseNavTitlesOnly ?? false}
                onCheckedChange={(checked) => handleToggleChange('enterpriseNavTitlesOnly', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layout className="h-4 w-4" />
                <Label htmlFor="enterprise-nav-simple-list">Enterprise Nav: Simple List</Label>
              </div>
              <Switch
                id="enterprise-nav-simple-list"
                checked={preferences?.enterpriseNavSimpleList ?? false}
                onCheckedChange={(checked) => handleToggleChange('enterpriseNavSimpleList', checked)}
              />
            </div>
          </div>

          {/* Content Options */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Content</h3>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layout className="h-4 w-4" />
                <Label htmlFor="boxed-layout">Boxed Layout</Label>
              </div>
              <Switch
                id="boxed-layout"
                checked={preferences?.boxedLayout ?? false}
                onCheckedChange={(checked) => handleToggleChange('boxedLayout', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Maximize className="h-4 w-4" />
                <Label htmlFor="fluid-container">Fluid Container</Label>
              </div>
              <Switch
                id="fluid-container"
                checked={preferences?.fluidContainer ?? true}
                onCheckedChange={(checked) => handleToggleChange('fluidContainer', checked)}
              />
            </div>
          </div>
        </TabsContent>

        {/* Behavior Tab */}
        <TabsContent value="behavior" className="space-y-6">
          {/* Default Landing Page */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Default Landing Page</h3>
            <RadioGroup
              value={preferences?.defaultLandingPage || 'dashboard'}
              onValueChange={(value) => updatePreferences({ defaultLandingPage: value as 'dashboard' | 'projects' })}
              className="grid grid-cols-2 gap-2"
            >
              <div>
                <RadioGroupItem
                  value="dashboard"
                  id="landing-dashboard"
                  className="sr-only"
                />
                <Label
                  htmlFor="landing-dashboard"
                  className={`flex flex-col items-center justify-center rounded-md border-2 border-muted p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer ${(preferences?.defaultLandingPage || 'dashboard') === 'dashboard' ? 'border-primary bg-accent' : ''}`}
                >
                  <Home className="mb-2 h-5 w-5" />
                  <span>Dashboard</span>
                </Label>
              </div>

              <div>
                <RadioGroupItem
                  value="projects"
                  id="landing-projects"
                  className="sr-only"
                />
                <Label
                  htmlFor="landing-projects"
                  className={`flex flex-col items-center justify-center rounded-md border-2 border-muted p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer ${(preferences?.defaultLandingPage || 'dashboard') === 'projects' ? 'border-primary bg-accent' : ''}`}
                >
                  <Folder className="mb-2 h-5 w-5" />
                  <span>Projects</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <EyeOff className="h-4 w-4" />
                <Label htmlFor="reduce-animations">Reduce Animations</Label>
              </div>
              <Switch
                id="reduce-animations"
                checked={preferences?.reduceAnimations ?? false}
                onCheckedChange={(checked) => handleToggleChange('reduceAnimations', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Palette className="h-4 w-4" />
                <Label htmlFor="high-contrast">High Contrast</Label>
              </div>
              <Switch
                id="high-contrast"
                checked={preferences?.highContrast ?? false}
                onCheckedChange={(checked) => handleToggleChange('highContrast', checked)}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Reset Button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          setTheme('system')
          setFontSize(14)
          setAnimationSpeed(300)
          updatePreferences({
            accentColor: 'gradient',
            fontSize: 14,
            animationSpeed: 300,
            sidebarFixed: false,
            sidebarMini: true,
            enterpriseNavTitlesOnly: false,
            enterpriseNavSimpleList: false,
            boxedLayout: false,
            fluidContainer: true,
            reduceAnimations: false,
            highContrast: false,
            defaultLandingPage: 'dashboard'
          })
          document.documentElement.style.fontSize = '14px'
          initializeAnimationSpeed(300)
        }}
      >
        Reset to Defaults
      </Button>
    </div>
  )
}

export default ThemeSettingsPanel
