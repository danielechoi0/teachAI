import React from "react";
import { Clock, MessageSquare, TrendingUp } from "lucide-react";
import StatCard from "./StatCard";

export default React.memo(function StatsSection() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <StatCard
        icon={<Clock className="w-6 h-6 text-emerald-600" />}
        label="Total Practice Time"
        value="24 mins"
        subtitle="This week"
        color="emerald"
      />
      <StatCard
        icon={<MessageSquare className="w-6 h-6 text-blue-600" />}
        label="Conversations"
        value="12"
        subtitle="Completed"
        color="blue"
      />
      <StatCard
        icon={<TrendingUp className="w-6 h-6 text-purple-600" />}
        label="Progress"
        value="78%"
        subtitle="This month"
        color="purple"
      />
    </div>
  );
});