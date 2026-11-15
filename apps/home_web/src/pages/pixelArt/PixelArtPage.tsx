import { Archive, Image, Layers, Mountain, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { LayerEditor } from '@/pages/pixelArt/LayerEditor'
import { PictureEditor } from '@/pages/pixelArt/PictureEditor'
import { PresetsPanel } from '@/pages/pixelArt/PresetsPanel'
import { SceneEditor } from '@/pages/pixelArt/SceneEditor'
import { usePictures } from '@/pixelArt/usePictures'
import { BUILT_IN_LAYERS } from '@/scenes/builtInLayers'
import { useSceneDesigns } from '@/scenes/useSceneDesigns'

type Tab = 'scenes' | 'layers' | 'pictures' | 'presets'

/**
 * Designs the backdrop behind every page, built up in levels: scenes stack up layers, layers place pictures, and
 * pictures are drawn pixel by pixel, each with variants and frames. Presets save the whole design to come back to.
 * Every change shows on every screen as soon as it is saved.
 */
export function PixelArtPage() {
  const [tab, setTab] = useState<Tab>('scenes')
  // Kept here, so that the Scenes tab can open one of a scene's layers on the Layers tab.
  const [chosenLayerId, setChosenLayerId] = useState(BUILT_IN_LAYERS[0].id)
  const pictures = usePictures()
  const designs = useSceneDesigns()
  const isUnreachable = pictures.hasFetchFailed || designs.hasFetchFailed

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 pb-10 sm:pb-14">
      <motion.header initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">Pixel art</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Design the background behind every page. Each scene is a stack of layers, such as the sky, the animals and the rain; each
          layer is a group of pictures; and each picture is drawn pixel by pixel. Save the whole design as a preset to keep it. Every
          screen picks up your changes straight away.
        </p>
      </motion.header>

      {isUnreachable && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          Can't reach the pixel art service right now, so what you see here may not match the site. Try again in a moment.
        </p>
      )}

      <div role="tablist" aria-label="What to design" className="flex w-fit flex-wrap gap-1 rounded-full bg-field p-1 shadow-md shadow-shade">
        <TabButton label="Scenes" icon={Mountain} isChosen={tab === 'scenes'} onChoose={() => setTab('scenes')} />
        <TabButton label="Layers" icon={Layers} isChosen={tab === 'layers'} onChoose={() => setTab('layers')} />
        <TabButton label="Pictures" icon={Image} isChosen={tab === 'pictures'} onChoose={() => setTab('pictures')} />
        <TabButton label="Presets" icon={Archive} isChosen={tab === 'presets'} onChoose={() => setTab('presets')} />
      </div>

      {/* All stay mounted, so that unsaved work on any of them survives a look at the others. */}
      <div hidden={tab !== 'scenes'}>
        <SceneEditor
          onEditLayer={(layerId) => {
            setChosenLayerId(layerId)
            setTab('layers')
          }}
        />
      </div>
      <div hidden={tab !== 'layers'}>
        <LayerEditor chosenLayerId={chosenLayerId} onChooseLayer={setChosenLayerId} />
      </div>
      <div hidden={tab !== 'pictures'}>
        <PictureEditor />
      </div>
      <div hidden={tab !== 'presets'}>
        <PresetsPanel />
      </div>
    </main>
  )
}

function TabButton({ label, icon: Icon, isChosen, onChoose }: { label: string; icon: LucideIcon; isChosen: boolean; onChoose: () => void }) {
  return (
    <Button role="tab" aria-selected={isChosen} variant={isChosen ? 'default' : 'ghost'} onClick={onChoose} className="h-11 rounded-full px-5 text-base font-bold">
      <Icon />
      {label}
    </Button>
  )
}
