import React from "react";
import { useNavigate } from "react-router-dom";
import { Globe, Users, User, Sparkles, BookOpen, ArrowRight } from "lucide-react";

export default function SignInPage() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-black flex items-center justify-center p-4 relative overflow-hidden font-poppins">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-r from-emerald-800/30 to-teal-800/30 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-32 right-16 w-40 h-40 bg-gradient-to-r from-blue-800/30 to-indigo-800/30 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-gradient-to-r from-purple-800/20 to-pink-800/20 rounded-full blur-lg animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl p-12 w-full max-w-lg border border-zinc-800">
        <div className="text-center mb-12">
          <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl transform hover:scale-105 transition-all duration-300">
            <img src="/favicon.png" alt="Edusona Logo" className="w-18 h-18" />
          </div>
          <h1 className="text-4xl font-semi-bold text-white mb-3">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Edusona
            </span>
          </h1>
          <p className="text-zinc-400 text-lg font-normal">a personalized conversation platform</p>
        </div>

        <div className="space-y-6">
          <button
            onClick={() => navigate("/student/setup")}
            className="w-full group relative bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-normal py-6 px-8 rounded-2xl shadow-xl flex items-center justify-between transition-all duration-300 hover:from-emerald-700 hover:to-teal-800 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] text-base"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                <User className="w-6 h-6 text-white/80" />
              </div>
              <div className="text-left">
                <div className="font-medium">I'm a Student</div>
                <div className="text-emerald-200 font-normal">Start practicing conversations</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 opacity-70 group-hover:animate-pulse text-emerald-200" />
              <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform text-emerald-200" />
            </div>
          </button>

          <button
            onClick={() => navigate("/teacher/dashboard")}
            className="w-full group relative bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-normal py-6 px-8 rounded-2xl shadow-xl flex items-center justify-between transition-all duration-300 hover:from-blue-700 hover:to-indigo-800 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] text-base"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                <Users className="w-6 h-6 text-white/80" />
              </div>
              <div className="text-left">
                <div className="font-medium">I'm a Teacher</div>
                <div className="text-blue-200 font-normal">Manage students & assistants</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 opacity-70 group-hover:animate-pulse text-blue-200" />
              <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform text-blue-200" />
            </div>
          </button>
        </div>

        <div className="mt-12 text-center">
          <p className="text-zinc-500 text-sm font-normal">
            AI-powered language learning tailored to you
          </p>
        </div>
      </div>
    </div>
  );
}