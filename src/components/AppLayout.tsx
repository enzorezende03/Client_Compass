import { NavLink } from '@/components/NavLink';
import { NotificationBell } from '@/components/NotificationBell';
import { Users, Building2, LayoutDashboard, CalendarClock, LogOut, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo-cshub.png';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card">
        <div className="container mx-auto px-6 flex items-center gap-1 h-14">
          <img src={logo} alt="CS HUB" className="h-8 mr-4" />
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
          <NavLink
            to="/gclick-sync"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            activeClassName="text-foreground bg-accent"
          >
            <RefreshCw className="h-4 w-4" />
            G-Click
          </NavLink>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
