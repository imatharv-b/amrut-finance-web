import { useContext } from 'react'
import { Minus, Square, X } from 'lucide-react'
import { SeasonContext } from '../context/SeasonContext'

export default function Titlebar() {
  const { activeSeason } = useContext(SeasonContext)

  const handleMinimize = () => {
    window.app?.minimize?.()
  }

  const handleMaximize = () => {
    window.app?.maximize?.()
  }

  const handleClose = () => {
    window.app?.close?.()
  }

  return (
    <header
      className="h-10 bg-primary-950 text-white flex items-center justify-between px-4 shrink-0 select-none"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Left: App name */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-semibold tracking-wide text-primary-200">
          Amrut Biochem Finance
        </span>
      </div>

      {/* Center: Active season */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {activeSeason && (
          <>
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
            <span className="text-xs text-primary-300 font-medium truncate max-w-[200px]">
              {activeSeason.name}
            </span>
          </>
        )}
      </div>

      {/* Right: Empty for web */}
      <div className="flex items-center gap-0.5">
      </div>
    </header>
  )
}
