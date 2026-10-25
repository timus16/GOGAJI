"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/shared/Button";
import Image from "next/image";

interface Wallpaper {
  id: string;
  image_url: string;
  nakshatra: string;
  resolution: string;
  created_at: string;
}

export function WallpaperGrid() {
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/wallpapers")
      .then(res => res.json())
      .then(data => {
        setWallpapers(data.wallpapers || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const downloadWallpaper = async (url: string, name: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const deleteWallpaper = async (id: string) => {
    if (!confirm("Delete this wallpaper permanently?")) return;
    try {
      await fetch(`/api/wallpapers/${id}`, { method: "DELETE" });
      setWallpapers(w => w.filter(w => w.id !== id));
    } catch (err) {
      alert("Failed to delete");
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="aspect-[9/16] bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (wallpapers.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 dark:text-slate-400">
        <p className="text-lg font-medium mb-2">No wallpapers yet</p>
        <p className="text-sm">Generate your first wallpaper to see it here</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {wallpapers.map((wp) => (
        <div key={wp.id} className="group relative bg-card rounded-xl overflow-hidden border">
          <div className="aspect-[9/16] relative overflow-hidden">
            <Image
              src={wp.image_url}
              alt={`${wp.nakshatra} wallpaper`}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          </div>
          <div className="p-3 space-y-1">
            <p className="font-medium truncate">{wp.nakshatra}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{wp.resolution}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(wp.created_at).toLocaleDateString()}</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 justify-center">
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/20" onClick={() => downloadWallpaper(wp.image_url, `nakshatra-${wp.nakshatra}.png`)}>
              Download
            </Button>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/20 text-red-400" onClick={() => deleteWallpaper(wp.id)}>
              Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
