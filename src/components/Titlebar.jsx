import { useContext } from 'react'
import { SeasonContext } from '../context/SeasonContext'
import { useCompany } from '../context/CompanyContext'
import { MobileMenuContext } from '../context/MobileMenuContext'
import { Building2, ArrowLeftRight, Menu } from 'lucide-react'

export default function Titlebar() {
  const { activeSeason } = useContext(SeasonContext)
  const { activeCompany, companies, selectCompany } = useCompany()
  const { isOpen, setIsOpen, isDesktopOpen, setIsDesktopOpen } = useContext(MobileMenuContext)

  const handleSwitchCompany = () => {
    selectCompany(null)
  }

  return (
    <header
      className="h-12 bg-white/40 backdrop-blur-2xl text-slate-800 flex items-center justify-between px-4 shrink-0 select-none border-b border-white/60 relative z-50 shadow-[0_4px_16px_rgba(0,0,0,0.02)]"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Left: App name */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={() => {
            if (window.innerWidth >= 768) {
              setIsDesktopOpen(!isDesktopOpen)
            } else {
              setIsOpen(!isOpen)
            }
          }}
          className="p-1 mr-1 text-slate-500 hover:text-slate-800 hover:bg-white/50 rounded-lg transition-all"
        >
          <Menu size={20} />
        </button>
        <span className="text-sm font-bold tracking-wide text-slate-700 hidden sm:inline-block">
          Amrut Biochem Finance
        </span>
      </div>

      {/* Center: Company & Season */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 max-w-[60%] sm:max-w-none overflow-x-auto no-scrollbar justify-center">
        {activeCompany && (
          <div className="flex items-center gap-2 bg-white/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/60 shadow-sm">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs text-slate-700 font-bold truncate max-w-[200px]">
              {activeCompany.name}
            </span>
            {companies.length > 1 && (
              <button 
                onClick={handleSwitchCompany} 
                className="text-slate-400 hover:text-slate-700 ml-2 transition-colors cursor-pointer"
                title="Switch Company"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {activeSeason && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 backdrop-blur-md text-emerald-600 rounded-full text-xs font-bold border border-emerald-500/20 shadow-sm">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="truncate max-w-[120px]">{activeSeason.name}</span>
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Empty space for window controls if using Electron */}
      </div>
    </header>
  )
}
