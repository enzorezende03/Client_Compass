import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ClientList from "./pages/ClientList";
import ClientDetail from "./pages/ClientDetail";
import ClientRegistration from "./pages/ClientRegistration";
import InternalUsersRegistration from "./pages/InternalUsersRegistration";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ClientList />} />
          <Route path="/client/:id" element={<ClientDetail />} />
          <Route path="/cadastro/clientes" element={<ClientRegistration />} />
          <Route path="/cadastro/usuarios" element={<InternalUsersRegistration />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
