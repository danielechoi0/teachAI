import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

export default function useTeacherSocket(isEnabled) {
  const sockRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isConnectedRef = useRef(false);

  useEffect(() => {
    if (!isEnabled || isConnectedRef.current) {
      return;
    }

    console.log("🔌 Initializing teacher socket connection...");
    isConnectedRef.current = true;

    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    console.log("Attempting to connect to:", `${backendUrl}/teacher`);

    // Create new socket connection
    const sock = io(`${backendUrl}/teacher`, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
    
    sockRef.current = sock;

    sock.on("connect", () => {
      console.log("✅ Teacher socket connected successfully");
      console.log("Socket ID:", sock.id);
    });
    
    sock.on("disconnect", (reason) => {
      console.log("❌ Teacher socket disconnected:", reason);
    });

    sock.on("connect_error", (error) => {
      console.error("❌ Teacher socket connection error:", error);
    });

    return () => {
      console.log("🧹 Cleaning up teacher socket connection");
      if (sockRef.current) {
        sockRef.current.removeAllListeners();
        sockRef.current.disconnect();
        sockRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      isConnectedRef.current = false;
    };
  }, [isEnabled]);

  const addEventListeners = (handlers) => {
    if (!sockRef.current) return;

    const { onNewCall, onCallEnded, onCallReport, setActiveCalls, showStatus } = handlers;

    sockRef.current.off("new_call");
    sockRef.current.off("call_ended");
    sockRef.current.off("call_report");
    sockRef.current.off("active_calls");

    // Add new listeners
    sockRef.current.on("new_call", data => {
      console.log("📞 New call received:", data);
      onNewCall?.(data);
      showStatus?.(`📞 New call from ${data.student}`, "success");
    });
    
    sockRef.current.on("call_ended", data => {
      console.log("📞 Call ended:", data);
      onCallEnded?.(data);
    });
    
    sockRef.current.on("call_report", data => {
      console.log("📊 Call report received:", data);
      onCallReport?.(data);
    });
    
    sockRef.current.on("active_calls", data => {
      console.log("📋 Active calls update:", data);
      setActiveCalls?.(data);
    });

    sockRef.current.off("connect");
    sockRef.current.off("disconnect");
    
    sockRef.current.on("connect", () => {
      console.log("✅ Teacher socket connected successfully");
    });
    
    sockRef.current.on("disconnect", (reason) => {
      console.log("❌ Teacher socket disconnected:", reason);
    });
  };

  return {
    socket: sockRef.current,
    isConnected: sockRef.current?.connected || false,
    addEventListeners
  };
}