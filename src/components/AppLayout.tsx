import { useLocation, useNavigate, NavLink as RouterNavLink } from 'react-router-dom';
import {
  BookOpen, Building2, CalendarClock, Clock3, LayoutDashboard, LogOut,
  Rocket, Users, MessageSquareWarning,
} from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import { SlaCatalogSheet } from '@/components/SlaCatalogSheet';
import { UrgentTaskAlert } from '@/components/UrgentTaskAlert';
import { Button } from '@/components/ui/button';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarRail, SidebarTrigger, useSidebar,
} from '@/components/ui/sidebar';
import { supabase } from '@/integrations/supabase/client';
import officialLogo from '@/assets/grupo-2-logo-oficial.png.asset.json';

interface NavigationItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const mainItems: NavigationItem[] = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard, end: true },
  { title: 'Clientes', url: '/cadastro/clientes', icon: Building2 },
  { title: 'Tarefas', url: '/tarefas', icon: CalendarClock },
  { title: 'Ocorrências', url: '/ocorrencias', icon: MessageSquareWarning },
  { title: 'Onboarding', url: '/onboarding', icon: Rocket },
];

const managementItems: NavigationItem[] = [
  { title: 'Usuários internos', url: '/cadastro/usuarios', icon: Users },
  { title: 'Prazos', url: '/prazos', icon: Clock3 },
  { title: 'Procedimento', url: '/procedimento-onboarding', icon: BookOpen },
];

const pageLabels: Array<[string, string]> = [
  ['/cadastro/clientes', 'Clientes'], ['/cadastro/usuarios', 'Usuários internos'],
  ['/tarefas', 'Central de tarefas'], ['/onboarding', 'Onboarding'], ['/ocorrencias', 'Ocorrências'],
  ['/prazos', 'Prazos das demandas'],
  ['/procedimento-onboarding', 'Procedimento de onboarding'], ['/', 'Dashboard'],
];

function Brand() {
  const { state } = useSidebar();
  return (
    <div className="flex h-16 items-center gap-2 px-1">
      <img
        src={officialLogo.url}
        alt="2M Grupo — Saúde e Contabilidade"
        className="h-12 w-16 shrink-0 object-contain object-center"
      />
      {state === 'expanded' && (
        <div className="min-w-0">
          <p className="font-heading text-lg font-bold leading-tight text-sidebar-primary-foreground">CS HUB</p>
          <div className="mt-0.5 text-[9px] font-semibold uppercase leading-tight text-sidebar-foreground/60">
            <span className="block">2M Saúde</span>
            <span className="block">2M Contabilidade</span>
          </div>
        </div>
      )}
    </div>
  );
}

function NavigationGroup({ label, items }: { label: string; items: NavigationItem[] }) {
  const { pathname } = useLocation();
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="font-semibold uppercase text-sidebar-foreground/45">{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map(item => {
            const isActive = item.end ? pathname === item.url : pathname.startsWith(item.url);
            return (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive} tooltip={item.title} className="h-10 gap-3 rounded-md px-3 data-[active=true]:border-l-2 data-[active=true]:border-sidebar-primary data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-primary">
                <RouterNavLink to={item.url} end={item.end}>
                  <item.icon className="h-4 w-4" /><span>{item.title}</span>
                </RouterNavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )})}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pageTitle = pageLabels.find(([path]) => path === '/' ? pathname === '/' : pathname.startsWith(path))?.[1] ?? 'CS HUB';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar collapsible="icon" className="border-sidebar-border">
          <SidebarHeader className="border-b border-sidebar-border p-2"><Brand /></SidebarHeader>
          <SidebarContent className="py-3">
            <NavigationGroup label="Operação" items={mainItems} />
            <NavigationGroup label="Gestão" items={managementItems} />
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border p-3">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Sair" onClick={handleLogout} className="h-10 gap-3 px-3">
                  <LogOut className="h-4 w-4" /><span>Sair</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center border-b bg-card/95 px-4 shadow-sm backdrop-blur md:px-6">
            <SidebarTrigger className="mr-3 h-9 w-9" aria-label="Recolher menu" />
            <div className="min-w-0">
              <p className="font-heading text-base font-semibold text-foreground">{pageTitle}</p>
              <p className="hidden text-xs text-muted-foreground sm:block">Ambiente operacional CS HUB</p>
            </div>
            <div className="ml-auto flex items-center gap-1 rounded-md border bg-background p-1 shadow-sm">
              <SlaCatalogSheet />
              <NotificationBell />
              <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sair" title="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
        <UrgentTaskAlert />
      </div>
    </SidebarProvider>
  );
}