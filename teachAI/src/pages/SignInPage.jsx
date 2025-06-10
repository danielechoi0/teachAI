import React from "react";
import { useNavigate } from "react-router-dom";
import { Globe, Users, User, Sparkles, BookOpen, ArrowRight } from "lucide-react";

export default function SignInPage() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-r from-emerald-200/30 to-teal-200/30 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-32 right-16 w-40 h-40 bg-gradient-to-r from-blue-200/30 to-indigo-200/30 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-gradient-to-r from-purple-200/20 to-pink-200/20 rounded-full blur-lg animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-12 w-full max-w-lg border border-white/50">
        <div className="text-center mb-12">
        <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-3xl flex items-center justify-center shadow-xl transform hover:scale-105 transition-all duration-300">
          <img src="/favicon.png" alt="TailorTalk Logo" className="w-18 h-18" />
        </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-3">
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              TailorTalk
            </span>
          </h1>
          <p className="text-gray-600 text-lg">Personalized AI conversation practice</p>
        </div>

        <div className="space-y-6">
          <button
            onClick={() => navigate("/student/setup")}
            className="w-full group relative bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium py-6 px-8 rounded-2xl shadow-xl flex items-center justify-between transition-all duration-300 hover:from-emerald-600 hover:to-teal-700 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <User className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="text-xl font-semibold">I'm a Student</div>
                <div className="text-emerald-100 text-sm">Start practicing conversations</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 opacity-80 group-hover:animate-pulse" />
              <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          <button
            onClick={() => navigate("/teacher/dashboard")}
            className="w-full group relative bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium py-6 px-8 rounded-2xl shadow-xl flex items-center justify-between transition-all duration-300 hover:from-blue-600 hover:to-indigo-700 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Users className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="text-xl font-semibold">I'm a Teacher</div>
                <div className="text-blue-100 text-sm">Manage students & assistants</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 opacity-80 group-hover:animate-pulse" />
              <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            AI-powered language learning tailored to you
          </p>
        </div>
      </div>
    </div>
  );
}