import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Users, Plus, Shield, Mail, CheckCircle2 } from 'lucide-react';

const mockTeams = [
  {
    id: 'team-1',
    name: 'Frontend Engineering',
    lead: 'Alex Morgan',
    leadAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    membersCount: 8,
    activeTasks: 18,
    focus: 'React, TypeScript, Vite, Tailwind CSS',
  },
  {
    id: 'team-2',
    name: 'Backend & Infrastructure',
    lead: 'Sarah Jenkins',
    leadAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    membersCount: 6,
    activeTasks: 14,
    focus: 'Supabase Auth, PostgreSQL, Row Level Security',
  },
  {
    id: 'team-3',
    name: 'Product Design (UX/UI)',
    lead: 'David Kim',
    leadAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    membersCount: 4,
    activeTasks: 10,
    focus: 'Figma System, Linear Design Language',
  },
];

export const Teams: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Organization
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-brand-600">3 Active Squads</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <Users className="w-6 h-6 text-brand-600" />
            Teams
          </h1>
        </div>

        <Button
          variant="primary"
          size="md"
          className="shadow-soft font-semibold text-xs"
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Team
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {mockTeams.map((team) => (
          <Card key={team.id} hoverEffect className="space-y-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Badge variant="primary" dot>
                  Active
                </Badge>
                <span className="text-xs font-semibold text-slate-500">
                  {team.membersCount} Members
                </span>
              </div>
              <CardTitle className="text-lg font-bold text-slate-900 pt-2">
                {team.name}
              </CardTitle>
              <CardDescription>{team.focus}</CardDescription>
            </CardHeader>

            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <Avatar src={team.leadAvatar} name={team.lead} size="xs" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Team Lead</span>
                    <span className="font-semibold text-slate-800">{team.lead}</span>
                  </div>
                </div>
                <Badge variant="neutral">{team.activeTasks} Tasks</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
