"use client";

import { CreditWallet } from "@/components/dashboard/CreditWallet";
import { WallpaperGrid } from "@/components/dashboard/WallpaperGrid";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold">Welcome back, {user?.email?.split("@")[0] || "User"}</h1>
        <p className="text-muted-foreground mt-1">Manage your generations and credits</p>
      </div>
      
      <CreditWallet />
      <WallpaperGrid />
    </div>
  );
}
