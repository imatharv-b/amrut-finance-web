import { useState, useContext, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Users,
  UserCheck,
  PlusCircle,
  FileText,
  Receipt,
  Settings2,
  Target,
  Ticket,
  CreditCard,
  BookOpen,
  BarChart3,
  Settings,
  ChevronDown,
  Leaf,
  Calendar,
  RotateCcw,
  LogOut,
  Briefcase
} from 'lucide-react'
import { SeasonContext } from '../context/SeasonContext'
import { supabase } from '../lib/supabase'
import { useCompany } from '../context/CompanyContext'

// ── Navigation Structure ─────────────────────────────────────────────
const NAVIGATION = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/',
    roles: ['admin'] // Only admin
  },
  {
    label: 'Masters',
    icon: Package,
    roles: ['admin', 'data_entry'],
    children: [
      { label: 'Products & Batches', icon: Package, path: '/masters/products' },
      { label: 'Parties', icon: Users, path: '/masters/parties' },
      { label: 'Associates', icon: UserCheck, path: '/masters/associates', roles: ['admin'] }
    ]
  },
  {
    label: 'Sales',
    icon: FileText,
    roles: ['admin', 'data_entry'],
    children: [
      { label: 'New Sale', icon: PlusCircle, path: '/sales/new' },
      { label: 'All Sales', icon: FileText, path: '/sales/all' },
      { label: 'Sale Returns', icon: RotateCcw, path: '/sales/return' }
    ]
  },
  {
    label: 'Expenses',
    icon: Receipt,
    roles: ['admin', 'data_entry'],
    children: [
      { label: 'New Expense', icon: PlusCircle, path: '/expenses/new' },
      { label: 'All Expenses', icon: Receipt, path: '/expenses/all' },
      { label: 'Expense Types', icon: Settings2, path: '/expenses/types' }
    ]
  },
  {
    label: 'Schemes',
    icon: Target,
    roles: ['admin'],
    children: [
      { label: 'Scheme Setup', icon: Target, path: '/schemes/setup' },
      { label: 'Coupon Issuance', icon: Ticket, path: '/schemes/coupons' }
    ]
  },
  {
    label: 'Workers',
    icon: Briefcase,
    roles: ['admin', 'data_entry'],
    children: [
      { label: 'All Workers', icon: Users, path: '/workers/all' },
      { label: 'Attendance', icon: Calendar, path: '/workers/attendance' },
      { label: 'Worker Ledger', icon: BookOpen, path: '/workers/ledger' },
      { label: 'Wage Register', icon: FileText, path: '/workers/summary' }
    ]
  },
  {
    label: 'Receipts',
    icon: CreditCard,
    roles: ['admin', 'data_entry'],
    children: [
      { label: 'Record Receipt', icon: CreditCard, path: '/payments/record' },
      { label: 'Party Ledger', icon: BookOpen, path: '/payments/ledger' }
    ]
  },
  {
    label: 'Reports & Analytics',
    icon: BarChart3,
    roles: ['admin'],
    children: [
      { label: 'Advanced Analytics', icon: BarChart3, path: '/analytics' },
      { label: 'Standard Reports', icon: FileText, path: '/reports' }
    ]
  },
  {
    label: 'Seasons',
    icon: Calendar,
    path: '/seasons',
    roles: ['admin']
  },
  {
    label: 'Settings',
    icon: Settings,
    path: '/settings',
    roles: ['admin']
  }
]

// ── NavItem Component ────────────────────────────────────────────────
function NavItem({ item, userRole }) {
  const location = useLocation()
  const [isExpanded, setIsExpanded] = useState(false)
  
  const allowedChildren = item.children ? item.children.filter(child => !child.roles || child.roles.includes(userRole)) : [];
  const hasChildren = allowedChildren.length > 0

  // Auto-expand if a child route is active
  useEffect(() => {
    if (hasChildren) {
      const childActive = allowedChildren.some((child) => location.pathname === child.path)
      if (childActive) setIsExpanded(true)
    }
  }, [location.pathname, hasChildren, allowedChildren])

  if (hasChildren) {
    return (
      <div className="mb-0.5">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg
            transition-all duration-200 text-primary-200 hover:bg-primary-800/50 hover:text-white
            ${isExpanded ? 'bg-primary-800/30 text-white' : ''}
          `}
        >
          <item.icon size={18} className="shrink-0 opacity-80" />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown
            size={16}
            className={`shrink-0 opacity-60 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Children */}
        <div
          className={`overflow-hidden transition-all duration-200 ease-in-out ${
            isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-primary-700/50 pl-0">
            {allowedChildren.map((child) => (
              <NavLink
                key={child.path}
                to={child.path}
                className={({ isActive }) => `
                  block w-full text-left pl-7 pr-4 py-2 text-sm rounded-r-lg transition-all duration-200
                  ${
                    isActive
                      ? 'bg-primary-800/40 text-white font-medium border-l-2 border-emerald-400'
                      : 'text-primary-200/80 hover:bg-primary-800/30 hover:text-white border-l-2 border-transparent'
                  }
                `}
              >
                <child.icon size={16} className="shrink-0 opacity-70" />
                <span>{child.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg mb-0.5
        transition-all duration-200
        ${
          isActive
            ? 'bg-primary-800 text-white border-l-3 border-accent-500 shadow-sm'
            : 'text-primary-200 hover:bg-primary-800/50 hover:text-white'
        }`
      }
    >
      <item.icon size={18} className="shrink-0 opacity-80" />
      <span>{item.label}</span>
    </NavLink>
  )
}

// ── Sidebar Component ────────────────────────────────────────────────
export default function Sidebar() {
  const { activeSeason } = useContext(SeasonContext)
  const { userRole } = useCompany()
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setUserEmail(session.user.email)
      }
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const role = userRole || 'admin';
  const allowedNav = NAVIGATION.filter(item => !item.roles || item.roles.includes(role))

  return (
    <aside className="w-[260px] shrink-0 bg-primary-900 text-white flex flex-col h-full overflow-hidden">
      {/* ── Logo Area ───────────────────────────────────────────── */}
      <div className="px-5 py-5 border-b border-primary-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-lg shadow-accent-500/20">
            <Leaf size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold tracking-tight leading-tight truncate">
              Amrut Biochem
            </h1>
            <p className="text-[11px] text-primary-400 font-medium truncate">Finance Manager</p>
            {userEmail && (
              <p className="text-[10px] text-primary-300/80 mt-0.5 truncate" title={userEmail}>
                {userEmail}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Navigation ──────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 scrollbar-thin">
        {allowedNav.map((item) => (
          <NavItem key={item.label} item={item} userRole={role} />
        ))}
      </nav>

      {/* ── Season Badge & Logout ────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-primary-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-primary-800/40 flex-1 min-w-0 mr-2">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] text-primary-400 font-medium uppercase tracking-wider">
              Active Season
            </p>
            <p className="text-xs text-white font-semibold truncate">
              {activeSeason?.name || 'No Season'}
            </p>
          </div>
        </div>
        
        <button 
          onClick={handleLogout}
          className="p-2.5 rounded-lg text-primary-300 hover:text-white hover:bg-red-500/80 transition-colors shrink-0"
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  )
}
