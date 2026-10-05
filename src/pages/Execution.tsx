import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TaskCenter from './TaskCenter';
import Onboarding from './Onboarding';

type Tab = 'tarefas' | 'onboarding' | 'calendario';
const KEY = 'cshub:execucao:tab';

export default function Execution() {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('aba') as Tab | null;
  const saved = (() => { try { return localStorage.getItem(KEY) as Tab | null; } catch { return null; } })();
  const tab: Tab = fromUrl && ['tarefas', 'onboarding', 'calendario'].includes(fromUrl) ? fromUrl : saved || 'tarefas';
  const change = (v: string) => {
    try { localStorage.setItem(KEY, v); } catch { /* indisponível */ }
    setParams({ aba: v }, { replace: true });
  };
  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-6">
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-foreground">Execução</h1>
        <Tabs value={tab} onValueChange={change}>
          <TabsList className="mb-4">
            <TabsTrigger value="tarefas">Tarefas do dia a dia</TabsTrigger>
            <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
            <TabsTrigger value="calendario">Calendário</TabsTrigger>
          </TabsList>
          <TabsContent value="tarefas"><TaskCenter embedded mode="regular" /></TabsContent>
          <TabsContent value="onboarding"><Onboarding embedded /></TabsContent>
          <TabsContent value="calendario"><TaskCenter embedded mode="calendar" /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
