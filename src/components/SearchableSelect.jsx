import { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search, Check, X } from 'lucide-react'

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState({})
  const containerRef = useRef(null)
  const dropdownRef = useRef(null)
  const searchInputRef = useRef(null)

  // ── Find selected option ───────────────────────────────────────
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  )

  // ── Filter options ─────────────────────────────────────────────
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options
    const lower = searchTerm.toLowerCase()
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lower) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(lower))
    )
  }, [options, searchTerm])

  // ── Close on outside click ─────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    // Also close on scroll to avoid floating dropdowns detached from the input
    const handleScroll = (e) => {
      if (isOpen && dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    window.addEventListener('scroll', handleScroll, true)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen])

  // ── Position dropdown ──────────────────────────────────────────
  useLayoutEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      
      if (isMobile) {
        setDropdownStyle({}) // Use CSS classes for mobile positioning
      } else {
        setDropdownStyle({
          position: 'fixed',
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
          zIndex: 9999
        })
      }
    }
  }, [isOpen])

  // ── Focus search on open ───────────────────────────────────────
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  const handleSelect = (opt) => {
    onChange?.(opt.value)
    setIsOpen(false)
    setSearchTerm('')
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between gap-2 px-3 py-2.5
          text-sm border rounded-lg transition-all
          ${disabled
            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            : 'bg-white border-slate-300 hover:border-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 cursor-pointer'
          }
          ${isOpen ? 'ring-2 ring-primary-500/20 border-primary-500' : ''}
        `}
      >
        <span className={`truncate ${selectedOption ? 'text-slate-800' : 'text-slate-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown via Portal */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop for mobile */}
          <div className="md:hidden fixed inset-0 bg-slate-900/40 z-[9998] animate-fadeIn" onClick={() => setIsOpen(false)} />
          
          <div 
            ref={dropdownRef}
            style={typeof window !== 'undefined' && window.innerWidth >= 768 ? dropdownStyle : {}}
            className={`bg-white border border-slate-200 overflow-hidden flex flex-col z-[9999] shadow-xl animate-scaleIn
              ${typeof window !== 'undefined' && window.innerWidth < 768 
                 ? 'fixed inset-0 pb-safe'
                 : 'rounded-xl'}`}
          >
            {/* Search */}
            <div className="p-3 border-b border-slate-100 shrink-0 flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm md:py-1.5 md:pl-8 md:pr-3 border border-slate-200 rounded-lg
                    bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500/30
                    focus:border-primary-400 placeholder:text-slate-400"
                />
              </div>
              {typeof window !== 'undefined' && window.innerWidth < 768 && (
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Options List */}
            <div className={`overflow-y-auto py-1 flex-1 ${typeof window !== 'undefined' && window.innerWidth >= 768 ? 'max-h-[220px]' : ''}`}>
              {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-slate-400">No results found</div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors
                    ${opt.value === value
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-700 hover:bg-slate-50'
                    }
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{opt.label}</p>
                    {opt.sublabel && (
                      <p className="text-xs text-slate-400 truncate">{opt.sublabel}</p>
                    )}
                  </div>
                  {opt.value === value && (
                    <Check size={16} className="shrink-0 text-primary-600" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
        </>,
        document.body
      )}
    </div>
  )
}
