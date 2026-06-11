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
      className="h-12 bg-primary-950 text-white flex items-center justify-between px-4 shrink-0 select-none border-b border-primary-900 relative z-50"
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
          className="p-1 mr-1 text-primary-200 hover:text-white hover:bg-primary-800 rounded transition"
        >
          <Menu size={20} />
        </button>
        <span className="text-sm font-semibold tracking-wide text-primary-200 hidden sm:inline-block">
          Amrut Biochem Finance
        </span>
      </div>

      {/* Center: Company & Season */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 max-w-[60%] sm:max-w-none overflow-x-auto no-scrollbar justify-center">
        {activeCompany && (
          <div className="flex items-center gap-2 bg-primary-900 px-3 py-1.5 rounded-full border border-primary-800">
            <Building2 className="w-3.5 h-3.5 text-primary-300" />
            <span className="text-xs text-primary-50 font-medium truncate max-w-[200px]">
              {activeCompany.name}
            </span>
            {companies.length > 1 && (
              <button 
                onClick={handleSwitchCompany} 
                className="text-primary-400 hover:text-white ml-2 transition-colors cursor-pointer"
                title="Switch Company"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {activeSeason && (
          <div className="flex items-center gap-2 bg-primary-900/50 px-3 py-1.5 rounded-full border border-primary-800/50">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
            <span className="text-xs text-primary-300 font-medium truncate max-w-[150px]">
              {activeSeason.name}
            </span>
          </div>
        )}
      </div>

      {/* Right: Empty for web */}
      <div className="flex items-center gap-0.5">
      </div>
    </header>
  )
}
