import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Execution from "./pages/Execution";
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
import Occurrences from "./pages/Occurrences";
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
          <Route path="/execucao" element={<AuthGuard><Execution /></AuthGuard>} />
          <Route path="/tarefas" element={<Navigate to="/execucao?aba=tarefas" replace />} />
          <Route path="/ocorrencias" element={<AuthGuard><Occurrences /></AuthGuard>} />
          <Route path="/onboarding" element={<Navigate to="/execucao?aba=onboarding" replace />} />
          <Route path="/prazos" element={<AuthGuard><SlaCatalogPage /></AuthGuard>} />
          <Route path="/procedimento-onboarding" element={<AuthGuard><OnboardingProcedure /></AuthGuard>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
