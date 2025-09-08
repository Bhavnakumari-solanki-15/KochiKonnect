import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BarChart3, Shield } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

const Navigation = () => {
  const location = useLocation();

  return (
    <nav className="border-b bg-gradient-to-r from-slate-900/95 via-blue-900/95 to-slate-900/95 backdrop-blur-md supports-[backdrop-filter]:bg-slate-900/90 shadow-lg">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 hover:opacity-90">
          <BrandLogo size={22} />
          <span className="font-bold text-xl text-white">KochiKonnect</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <ThemeToggle />
          
          <div className="flex items-center gap-2">
            <Button
              variant={location.pathname === "/dashboard" ? "default" : "ghost"}
              asChild
              className={location.pathname === "/dashboard" ? "bg-blue-600 hover:bg-blue-700 text-white" : "text-white hover:bg-white/10"}
            >
              <Link to="/dashboard" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Dashboard
              </Link>
            </Button>

            <Button
              variant={location.pathname === "/admin" ? "default" : "ghost"}
              asChild
              className={location.pathname === "/admin" ? "bg-blue-600 hover:bg-blue-700 text-white" : "text-white hover:bg-white/10"}
            >
              <Link to="/admin" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;