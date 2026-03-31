"use client";

import React, { useState, useEffect } from "react";
import { Camera, AlertTriangle, Activity, History, MapPin, LayoutDashboard, FileText, CheckCircle, Video, Laptop, Trash2 } from "lucide-react";

export default function App() {
  // 1. CHANGED DEFAULT TAB TO OVERVIEW
  const [activeTab, setActiveTab] = useState("overview"); 
  const [isLive, setIsLive] = useState(false);
  const [stats, setStats] = useState({ fps: 0, hazard_count: 0 });
  const [historyLog, setHistoryLog] = useState([]); // Separate state for full history
  const [sourceType, setSourceType] = useState("video"); 
  const [streamTrigger, setStreamTrigger] = useState(Date.now()); 

  const API_URL = "http://127.0.0.1:8000";
  const VIDEO_URL = `${API_URL}/video_feed?t=${streamTrigger}`;

  // --- SOURCE SWITCH ---
  const handleSourceSwitch = async (type: string) => {
    try {
        await fetch(`${API_URL}/set_source`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source_type: type })
        });
        setSourceType(type);
        // Force reload video element
        setStreamTrigger(Date.now());
    } catch (error) {
        console.error("Failed to switch source:", error);
    }
  };

  // --- START/STOP ---
  const toggleSystem = async () => {
    const newStatus = !isLive;
    setIsLive(newStatus); 

    try {
      await fetch(`${API_URL}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: newStatus ? "start" : "stop" }),
      });
    } catch (error) {
      console.error("Failed to control system:", error);
    }
  };

  // --- DELETE ALERT ---
  const deleteAlert = async (id: number) => {
      try {
          await fetch(`${API_URL}/history/${id}`, { method: "DELETE" });
          // Update local state immediately for UI responsiveness
          setHistoryLog(prev => prev.filter((item: any) => item.id !== id));
      } catch (error) {
          console.error("Failed to delete:", error);
      }
  }

  // --- DATA POLLING ---
  useEffect(() => {
    const interval = setInterval(async () => {
        try {
            // Fetch Stats
            const statsRes = await fetch(`${API_URL}/stats`);
            const statsData = await statsRes.json();
            setStats(statsData);

            // Fetch History (Persistent)
            const historyRes = await fetch(`${API_URL}/history`);
            const historyData = await historyRes.json();
            setHistoryLog(historyData);

        } catch (error) {
            // Silently fail if backend is offline
        }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-orange-500 selection:text-white">
      
      {/* NAVBAR */}
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab("overview")}>
            <div className="bg-gradient-to-tr from-orange-500 to-red-600 p-2 rounded-lg shadow-lg shadow-orange-500/20">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              RoadGuard AI
            </span>
          </div>
          
          <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
            <NavButton label="Overview" icon={<LayoutDashboard size={14}/>} active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
            <NavButton label="Live Feed" icon={<Activity size={14}/>} active={activeTab === "live"} onClick={() => setActiveTab("live")} />
            <NavButton label="History Log" icon={<FileText size={14}/>} active={activeTab === "history"} onClick={() => setActiveTab("history")} />
          </div>
          <div className="w-8"></div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="text-center space-y-4 py-20">
                <h1 className="text-6xl font-extrabold tracking-tight mb-6">
                    Smart Road <span className="text-orange-500">Hazard Detection</span>
                </h1>
                <p className="text-slate-400 text-xl max-w-2xl mx-auto leading-relaxed">
                    An automated computer vision system utilizing <span className="text-white font-semibold">YOLOv8n</span> to identify potholes, cracks, and open manholes in real-time.
                </p>
                <div className="flex justify-center gap-4 pt-8">
                    <button onClick={() => setActiveTab("live")} className="px-8 py-4 bg-white text-slate-900 font-bold rounded-full hover:bg-slate-200 transition-all flex items-center gap-2 shadow-xl shadow-white/10">
                        <Camera size={20}/> Launch System
                    </button>
                    <button onClick={() => setActiveTab("history")} className="px-8 py-4 bg-slate-800 text-white font-bold rounded-full hover:bg-slate-700 transition-all border border-slate-700">
                        View Logs
                    </button>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <InfoCard icon={<Activity className="text-blue-400"/>} title="Real-Time Analysis" desc="High FPS processing ensuring immediate hazard recognition on edge devices." />
                <InfoCard icon={<AlertTriangle className="text-orange-400"/>} title="Driver Alerts" desc="Visual warnings deployed instantly when dangerous road conditions are detected." />
                <InfoCard icon={<History className="text-green-400"/>} title="Automated Logging" desc="All detections are timestamped and archived for maintenance review." />
            </div>
          </div>
        )}

        {/* LIVE FEED TAB */}
        {activeTab === "live" && (
            <div className="animate-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Live Hazard Detection</h1>
                        <p className="text-slate-400">Monitoring via YOLOv8n</p>
                    </div>

                    {/* CONTROL BAR */}
                    <div className="flex items-center gap-4 bg-slate-900 p-2 rounded-xl border border-slate-800 shadow-lg">
                        <div className="flex bg-slate-800 rounded-lg p-1">
                            <button 
                                onClick={() => handleSourceSwitch("video")}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${sourceType === "video" ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-white"}`}
                            >
                                <Video size={14}/> Video
                            </button>
                            <button 
                                onClick={() => handleSourceSwitch("webcam")}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${sourceType === "webcam" ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-white"}`}
                            >
                                <Laptop size={14}/> Dashcam
                            </button>
                        </div>
                        
                        <div className="w-px h-8 bg-slate-800"></div>

                        <button 
                            onClick={toggleSystem}
                            className={`px-6 py-2 font-semibold rounded-lg transition-colors shadow-lg min-w-[140px] flex justify-center ${isLive ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-white text-slate-900 hover:bg-slate-200'}`}
                        >
                            {isLive ? "Stop Camera" : "Start Camera"}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Video Area */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl shadow-orange-900/10">
                    {isLive ? (
                        <img src={VIDEO_URL} alt="Live Dashcam Feed" className="w-full h-full object-cover"/>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                            <Camera className="w-16 h-16 mb-4 opacity-50" />
                            <p>Camera Offline</p>
                            <p className="text-xs mt-2 text-slate-500">Source: {sourceType === "video" ? "Sample File" : "Webcam"}</p>
                        </div>
                    )}
                    
                    {isLive && (
                         <div className="absolute top-4 left-4 flex gap-2">
                             <div className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded animate-pulse">LIVE</div>
                             <div className="bg-black/50 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded border border-white/10 flex items-center gap-1">
                                 {sourceType === "video" ? <Video size={10}/> : <Laptop size={10}/>} 
                                 {sourceType === "video" ? "Video File" : "Webcam"}
                             </div>
                         </div>
                    )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <StatBox label="FPS" value={stats.fps} icon={<Activity size={14}/>} />
                        <StatBox label="Hazards" value={historyLog.length} icon={<AlertTriangle size={14}/>} color="text-orange-400"/>
                        <StatBox label="Status" value={isLive ? "Active" : "Ready"} icon={<CheckCircle size={14}/>} color={isLive ? "text-green-400" : "text-slate-400"}/>
                    </div>
                </div>

                {/* Sidebar Log */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-[500px] overflow-y-auto flex flex-col">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2 sticky top-0 bg-slate-900 pb-2 border-b border-slate-800 z-10">
                        <History className="w-5 h-5 text-orange-500"/> Recent Alerts
                    </h3>
                    <div className="space-y-3 flex-1">
                        {historyLog.length === 0 ? (
                             <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-60">
                                <CheckCircle size={40} className="mb-2"/>
                                <p className="text-sm">No hazards yet</p>
                             </div>
                        ) : (
                            historyLog.slice(0, 10).map((alert: any) => (
                                <AlertItem key={alert.id} alert={alert} />
                            ))
                        )}
                    </div>
                </div>
                </div>
            </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
            <div className="animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold">Detection Log</h1>
                    <div className="text-slate-400 text-sm">{historyLog.length} Records Found</div>
                </div>
                
                {historyLog.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {historyLog.map((alert: any) => (
                            <div key={alert.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-orange-500/50 transition-colors group relative">
                                <div className="aspect-video bg-black relative">
                                    <img src={alert.image_url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"/>
                                    <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-orange-400 font-mono">
                                        {alert.conf}
                                    </div>
                                </div>
                                <div className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-white">{alert.type}</h4>
                                            <p className="text-sm text-slate-400 mt-1">{alert.time}</p>
                                            <p className="text-xs text-slate-500 mt-1">{alert.date}</p>
                                        </div>
                                        <button 
                                            onClick={() => deleteAlert(alert.id)}
                                            className="p-2 hover:bg-red-500/20 hover:text-red-500 rounded-lg text-slate-600 transition-colors"
                                            title="Delete Record"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
                        <History className="mx-auto h-12 w-12 text-slate-600 mb-4" />
                        <h3 className="text-lg font-medium text-white">No records found</h3>
                        <p className="text-slate-400">Start the camera in the Live Feed to begin collecting data.</p>
                    </div>
                )}
            </div>
        )}

      </main>
    </div>
  );
}

// SUB COMPONENTS
function NavButton({ label, icon, active, onClick }: any) {
    return (
        <button 
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                active ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
        >
            {icon} {label}
        </button>
    )
}

function StatBox({ label, value, icon, color = "text-white" }: any) {
    return (
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 backdrop-blur-sm">
            <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1 flex items-center gap-2 font-bold">
                {icon} {label}
            </div>
            <div className={`text-2xl font-mono font-bold ${color}`}>{value}</div>
        </div>
    )
}

function AlertItem({ alert }: any) {
    return (
        <div className="flex gap-4 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800 transition-colors">
            <div className="w-16 h-16 bg-slate-900 rounded-md overflow-hidden flex-shrink-0 border border-slate-700">
                <img src={alert.image_url} className="w-full h-full object-cover"/>
            </div>
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-white">{alert.type}</span>
                    <span className="text-[10px] bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded border border-orange-500/20">{alert.conf}</span>
                </div>
                <p className="text-xs text-slate-400 font-mono">{alert.time}</p>
            </div>
        </div>
    )
}

function InfoCard({ icon, title, desc }: any) {
    return (
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all">
            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-4">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-slate-400 leading-relaxed">{desc}</p>
        </div>
    )
}