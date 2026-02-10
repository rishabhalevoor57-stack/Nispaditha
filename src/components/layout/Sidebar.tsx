import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  Users, 
  Wallet, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Gem,
  Menu,
  ClipboardList,
  Truck,
  History,
  ArrowLeftRight,
  Hammer
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Package, label: 'Inventory', path: '/inventory' },
  { icon: FileText, label: 'Invoices', path: '/invoices' },
  { icon: ArrowLeftRight, label: 'Returns', path: '/returns' },
  { icon: ClipboardList, label: 'Order Notes', path: '/order-notes' },
  { icon: Hammer, label: 'Custom Orders', path: '/custom-orders' },
  { icon: Users, label: 'Clients', path: '/clients' },
  { icon: Truck, label: 'Vendors', path: '/vendors' },
  { icon: Wallet, label: 'Expenses', path: '/expenses' },
  { icon: History, label: 'Activity Log', path: '/activity-log' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

interface SidebarContentProps {
  collapsed: boolean;
  onCollapse?: () => void;
}

const SidebarContent = ({ collapsed, onCollapse }: SidebarContentProps) => {
  const location = useLocation();
  const { signOut, user, userRole } = useAuth();

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sidebar-primary">
          <Gem className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg tracking-tight truncate">SmartBiz</h1>
            <p className="text-xs text-sidebar-foreground/60 truncate">Manager</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onCollapse}
              className={cn(
                'sidebar-link',
                isActive && 'active'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-sidebar-border">
        {!collapsed && (
          <div className="mb-3 px-3 py-2">
            <p className="text-sm font-medium truncate">{user?.email}</p>
            <p className="text-xs text-sidebar-foreground/60 capitalize">{userRole || 'User'}</p>
          </div>
        )}
        <button
          onClick={() => signOut()}
          className="sidebar-link w-full text-destructive/80 hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );
};

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col h-screen sticky top-0 transition-all duration-300 ease-in-out',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        <SidebarContent collapsed={collapsed} />
        
        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-8 flex items-center justify-center w-6 h-6 rounded-full bg-sidebar-primary text-sidebar-primary-foreground shadow-lg hover:scale-110 transition-transform"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile Header & Sidebar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-16 bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sidebar-primary">
            <Gem className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          <span className="font-bold">SmartBiz</span>
        </div>
        
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border">
            <SidebarContent collapsed={false} onCollapse={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
};
