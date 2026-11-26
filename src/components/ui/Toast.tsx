"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { gsap } from "gsap";
import { X, AlertCircle, CheckCircle, Info, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";

interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info" | "loading";
  title: string;
  message?: string;
  duration?: number;
  dismissible?: boolean;
}

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 300;

let toastCount = 0;
const generateId = () => `${Date.now()}-${++toastCount}`;

const toasts: Toast[] = [];
let listeners: Array<(toasts: Toast[]) => void> = [];

function notify() {
  listeners.forEach((listener) => listener([...toasts]));
}

function addToast(toast: Omit<Toast, "id">) {
  const id = generateId();
  const newToast = { ...toast, id };
  toasts.push(newToast);
  notify();
  
  if (toast.duration !== 0 && toast.duration !== Infinity) {
    setTimeout(() => dismissToast(id), toast.duration ?? 5000);
  }
  
  return id;
}

function dismissToast(id: string) {
  const index = toasts.findIndex((t) => t.id === id);
  if (index !== -1) {
    toasts.splice(index, 1);
    notify();
  }
}

function dismissAllToasts() {
  toasts.length = 0;
  notify();
}

export function useToast() {
  const [state, setState] = useState<Toast[]>(toasts);
  
  useEffect(() => {
    listeners.push(setState);
    return () => {
      listeners = listeners.filter((l) => l !== setState);
    };
  }, []);
  
  const toast = useCallback((options: Omit<Toast, "id">) => {
    return addToast(options);
  }, []);
  
  const dismiss = useCallback((id: string) => {
    dismissToast(id);
  }, []);
  
  return { toasts: state, toast, dismiss, dismissAll: dismissAllToasts };
}

export function ToastContainer() {
  const { toasts, dismiss } = useToast();
  
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isExiting, setIsExiting] = useState(false);
  
  useEffect(() => {
    const element = ref.current;
    if (element) {
      gsap.fromTo(element,
        { opacity: 0, x: 100, scale: 0.9 },
        { opacity: 1, x: 0, scale: 1, duration: 0.3, ease: "expo.out" }
      );
    }
    
    if (toast.type === "loading") {
      const loader = element?.querySelector(".toast-loader");
      if (loader) {
        gsap.to(loader, { rotation: 360, duration: 1, ease: "none", repeat: -1 });
      }
    }
  }, [toast.type]);
  
  const handleDismiss = () => {
    setIsExiting(true);
    const element = ref.current;
    if (element) {
      gsap.to(element, {
        opacity: 0,
        x: 100,
        scale: 0.9,
        duration: 0.2,
        ease: "power2.in",
        onComplete: () => onDismiss(toast.id),
      });
    } else {
      onDismiss(toast.id);
    }
  };
  
  if (isExiting) return null;
  
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
    error: <AlertCircle className="w-5 h-5 text-vermilion-400" />,
    warning: <AlertCircle className="w-5 h-5 text-saffron-400" />,
    info: <Info className="w-5 h-5 text-saffron-400" />,
    loading: <Loader2 className="w-5 h-5 toast-loader text-saffron-400" />,
  };
  
  const bgColors = {
    success: "bg-emerald-500/10 border-emerald-500/20",
    error: "bg-vermilion-500/10 border-vermilion-500/20",
    warning: "bg-saffron-500/10 border-saffron-500/20",
    info: "bg-saffron-500/10 border-saffron-500/20",
    loading: "bg-saffron-500/10 border-saffron-500/20",
  };
  
  const titleColors = {
    success: "text-emerald-400",
    error: "text-vermilion-400",
    warning: "text-saffron-400",
    info: "text-saffron-400",
    loading: "text-saffron-400",
  };
  
  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-auto flex items-start gap-3 w-80 px-4 py-3 rounded-2xl border backdrop-blur-sm shadow-2xl animate-in slide-in-from-right duration-300",
        bgColors[toast.type]
      )}
      role="alert"
      aria-live={toast.type === "error" ? "assertive" : "polite"}
    >
      <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className={cn("font-medium text-sm", titleColors[toast.type])}>{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-neutral-400 mt-0.5">{toast.message}</p>
        )}
      </div>
      {toast.dismissible !== false && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-white/5 transition-colors text-neutral-500 hover:text-neutral-300"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function toast(options: Omit<Toast, "id">) {
  return addToast(options);
}

toast.success = (title: string, message?: string, options?: Partial<Toast>) => 
  addToast({ type: "success", title, message, ...options });

toast.error = (title: string, message?: string, options?: Partial<Toast>) => 
  addToast({ type: "error", title, message, ...options });

toast.warning = (title: string, message?: string, options?: Partial<Toast>) => 
  addToast({ type: "warning", title, message, ...options });

toast.info = (title: string, message?: string, options?: Partial<Toast>) => 
  addToast({ type: "info", title, message, ...options });

toast.loading = (title: string, message?: string, options?: Partial<Toast>) => 
  addToast({ type: "loading", title, message, duration: Infinity, dismissible: false, ...options });

toast.promise = async <T,>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: Error) => string);
  }
) => {
  const loadingId = toast.loading(messages.loading);
  try {
    const data = await promise;
    dismissToast(loadingId);
    const successMsg = typeof messages.success === "function" ? messages.success(data) : messages.success;
    toast.success(successMsg);
    return data;
  } catch (err) {
    dismissToast(loadingId);
    const errorMsg = typeof messages.error === "function" ? messages.error(err as Error) : messages.error;
    toast.error(errorMsg);
    throw err;
  }
};