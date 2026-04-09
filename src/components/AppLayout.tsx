import { NavLink } from '@/components/NavLink';
import { NotificationBell } from '@/components/NotificationBell';
import { Users, Building2, LayoutDashboard, CalendarClock } from 'lucide-react';

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card">
        <div className="container mx-auto px-6 flex items-center gap-1 h-12">
          <NavLink
            to="/"
            end
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            activeClassName="text-foreground bg-accent"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </NavLink>
          <NavLink
            to="/cadastro/clientes"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            activeClassName="text-foreground bg-accent"
          >
            <Building2 className="h-4 w-4" />
            Clientes
          </NavLink>
          <NavLink
            to="/tarefas"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            activeClassName="text-foreground bg-accent"
          >
            <CalendarClock className="h-4 w-4" />
            Tarefas
          </NavLink>
          <NavLink
            to="/cadastro/usuarios"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            activeClassName="text-foreground bg-accent"
          >
            <Users className="h-4 w-4" />
            Usuários Internos
          </NavLink>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
