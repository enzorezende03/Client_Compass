import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TaskCenter from './TaskCenter';
import Onboarding from './Onboarding';

type Tab = 'todos' | 'onboarding' | 'diadia';
const KEY = 'cshub:execucao:tab';

/** Migrates tab names saved before the "Central de Execução" redesign. */
function normalizeTab(v: string | null): Tab | null {
  if (v === 'todos' || v === 'onboarding' || v === 'diadia') return v;
  if (v === 'tarefas') return 'diadia';
  if (v === 'calendario') return 'todos';
  return null;
}

export default function Execution() {
  const [params, setParams] = useSearchParams();
  const fromUrl = normalizeTab(params.get('aba'));
  const saved = (() => { try { return normalizeTab(localStorage.getItem(KEY)); } catch { return null; } })();
  const tab: Tab = fromUrl || saved || 'todos';
  const change = (v: string) => {
    try { localStorage.setItem(KEY, v); } catch { /* indisponível */ }
    setParams({ aba: v }, { replace: true });
  };
  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Central de Execução</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Acompanhe e gerencie todas as tarefas de onboarding e dia a dia dos seus clientes.
        </p>
        <Tabs value={tab} onValueChange={change}>
          <TabsList className="mb-4">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
            <TabsTrigger value="diadia">Dia a dia</TabsTrigger>
          </TabsList>
          <TabsContent value="todos"><TaskCenter embedded mode="calendar" /></TabsContent>
          <TabsContent value="onboarding"><Onboarding embedded /></TabsContent>
          <TabsContent value="diadia"><TaskCenter embedded mode="regular" /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
