import { useState, useEffect } from 'react'
import { useThemeStore } from '@/stores/theme-store'
import { usePreferencesStore } from '@/stores/preferences-store'
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

  // Initialize animation speed on a mount
  useEffect(() => {
    if (preferences?.animationSpeed) {
      initializeAnimationSpeed(preferences.animationSpeed)
    }
  }, [preferences.animationSpeed])

  // Accent choice (default theme)
  const currentAccentChoice = preferences?.accentColor || 'gradient'

  // Handle accent choice change
  const handleAccentChoiceChange = (choice: string) => {
    updatePreferences({ accentColor: choice as never })
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
          {/* Accent Color / Theme */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Accent Color</h3>
            <div className="theme-swatch-grid grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                className={`h-auto flex flex-col items-center justify-center p-4 ${currentAccentChoice === 'gradient' ? 'border-primary bg-accent' : ''}`}
                onClick={() => handleAccentChoiceChange('gradient')}
              >
                <div
                  className="w-6 h-6 rounded-full mb-2"
                  style={{ backgroundImage: 'linear-gradient(90deg, #D1D5DB, #9CA3AF)' }}
                />
                <span className="theme-swatch-label text-xs font-medium" style={{ color: '#1e293b' }}>Default</span>
              </Button>
              <Button
                variant="outline"
                className={`theme-swatch-dark-bg h-auto flex flex-col items-center justify-center p-4 ${currentAccentChoice === 'deep-cosmic' ? 'border-primary bg-accent' : ''}`}
                onClick={() => handleAccentChoiceChange('deep-cosmic')}
              >
                <div
                  className="w-6 h-6 rounded-full mb-2"
                  style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #1F3C88 50%, #6A7FDB 100%)' }}
                />
                <span className="theme-swatch-label theme-swatch-label-dark text-xs text-center leading-tight" style={{ color: '#1e293b' }}>Deep Cosmic</span>
              </Button>
              <Button
                variant="outline"
                className={`theme-swatch-dark-bg h-auto flex flex-col items-center justify-center p-4 ${currentAccentChoice === 'indigo-command' ? 'border-primary bg-accent' : ''}`}
                onClick={() => handleAccentChoiceChange('indigo-command')}
              >
                <div
                  className="w-6 h-6 rounded-full mb-2"
                  style={{ background: 'linear-gradient(135deg, #112240 0%, #2E4F9C 100%)' }}
                />
                <span className="theme-swatch-label theme-swatch-label-dark text-xs text-center leading-tight" style={{ color: '#1e293b' }}>Indigo</span>
              </Button>
              <Button
                variant="outline"
                className={`h-auto flex flex-col items-center justify-center p-4 ${currentAccentChoice === 'frosted-steel' ? 'border-primary bg-accent' : ''}`}
                onClick={() => handleAccentChoiceChange('frosted-steel')}
              >
                <div
                  className="w-6 h-6 rounded-full mb-2"
                  style={{ background: 'linear-gradient(135deg, #94A3B8 0%, #0EA5E9 100%)' }}
                />
                <span className="theme-swatch-label text-xs text-center leading-tight font-medium" style={{ color: '#1e293b' }}>Frosted Steel</span>
              </Button>
              <Button
                variant="outline"
                className={`theme-swatch-dark-bg h-auto flex flex-col items-center justify-center p-4 ${currentAccentChoice === 'blue-granite' ? 'border-primary bg-accent' : ''}`}
                onClick={() => handleAccentChoiceChange('blue-granite')}
              >
                <div
                  className="w-6 h-6 rounded-full mb-2"
                  style={{ background: 'linear-gradient(135deg, #1C2638 0%, #243B6B 50%, #4F5D75 100%)' }}
                />
                <span className="theme-swatch-label theme-swatch-label-dark text-xs text-center leading-tight" style={{ color: '#1e293b' }}>Blue Granite</span>
              </Button>
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
