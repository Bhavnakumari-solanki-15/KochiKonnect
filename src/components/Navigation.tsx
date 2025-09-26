import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import CardNav from "@/components/CardNav";
import logo from "/Koch_Metro_Logo.png";

const Navigation = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const items = [
    {
      label: "Admin",
      bgColor: "#E6F4FF",
      textColor: "#0F172A",
      href: "/admin",
      links: [],
    },
    {
      label: "Dashboard",
      bgColor: "#EEF2FF",
      textColor: "#0F172A",
      href: "/dashboard",
      links: [],
    },
    {
      label: "Support",
      bgColor: "#FFF7ED",
      textColor: "#0F172A",
      href: "https://kochimetro.org/",
      links: [],
    },
  ];

  return (
    <div className="relative">
      <CardNav
        logo={logo}
        logoAlt="KochiKonnect"
        items={items}
        baseColor="#fff"
        menuColor="#000"
        buttonBgColor="#111"
        buttonTextColor="#fff"
        ctaHref="/dashboard"
        ctaLabel="Dashboard"
      />
      <div className="h-24" />
    </div>
  );
};

export default Navigation;