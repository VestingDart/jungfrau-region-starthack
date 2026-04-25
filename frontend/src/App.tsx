import { AnimatePresence } from "framer-motion";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import WelcomePage from "./pages/WelcomePage";
import GuestPage from "./pages/GuestPage";
import PartnerPage from "./pages/PartnerPage";
import AdminPage from "./pages/AdminPage";

export default function App() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/guest" element={<GuestPage />} />
        <Route path="/partner" element={<PartnerPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}
