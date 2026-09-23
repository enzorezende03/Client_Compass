import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import SlaCatalogPage from "./pages/SlaCatalogPage";
import OnboardingProcedure from "./pages/OnboardingProcedure";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/components/AuthGuard";
import ClientList from "./pages/ClientList";
import ClientDetail from "./pages/ClientDetail";
import ClientRegistration from "./pages/ClientRegistration";
import ClientFormPage from "./pages/ClientFormPage";
import InternalUsersRegistration from "./pages/InternalUsersRegistration";
import TaskCenter from "./pages/TaskCenter";
import Occurrences from "./pages/Occurrences";
import Onboarding from "./pages/Onboarding";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<AuthGuard><ClientList /></AuthGuard>} />
          <Route path="/client/:id" element={<AuthGuard><ClientDetail /></AuthGuard>} />
          <Route path="/cadastro/clientes" element={<AuthGuard><ClientRegistration /></AuthGuard>} />
          <Route path="/cadastro/clientes/novo" element={<AuthGuard><ClientFormPage /></AuthGuard>} />
          <Route path="/cadastro/clientes/:id/editar" element={<AuthGuard><ClientFormPage /></AuthGuard>} />
          <Route path="/cadastro/usuarios" element={<AuthGuard><InternalUsersRegistration /></AuthGuard>} />
          <Route path="/tarefas" element={<AuthGuard><TaskCenter /></AuthGuard>} />
          <Route path="/ocorrencias" element={<AuthGuard><Occurrences /></AuthGuard>} />
          <Route path="/onboarding" element={<AuthGuard><Onboarding /></AuthGuard>} />
          <Route path="/prazos" element={<AuthGuard><SlaCatalogPage /></AuthGuard>} />
          <Route path="/procedimento-onboarding" element={<AuthGuard><OnboardingProcedure /></AuthGuard>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
