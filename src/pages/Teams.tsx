import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Input } from '../components/ui/Input';
import { Users, Plus, Cpu, Wrench, Binary, Network, ShieldCheck, UserCheck, Shield } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Team, UserProfile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const Teams: React.FC = () => {
  const { user, userRole } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Team Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isManagerOrAdmin = userRole === 'SuperAdmin' || userRole === 'Admin' || userRole === 'Manager';

  const loadTeamsData = async () => {
    setIsLoading(true);
    if (!isSupabaseConfigured) {
      setTeams(fallbackTeams);
      setIsLoading(false);
      return;
    }

    try {
      const [teamsRes, profilesRes] = await Promise.all([
        supabase.from('teams').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('status', 'Approved'),
      ]);

      if (profilesRes.data) {
        setProfiles(profilesRes.data as UserProfile[]);
      }

      if (teamsRes.data && teamsRes.data.length > 0) {
        const mappedTeams: Team[] = teamsRes.data.map((t) => {
          const lead = profilesRes.data?.find((p) => p.id === t.lead_id);
          const membersCount = profilesRes.data?.filter((p) => p.team_id === t.id).length || 0;
          return {
            id: t.id,
            name: t.name,
            description: t.description || 'Engineering & Operations Team',
            lead_id: t.lead_id,
            lead_name: lead?.full_name || 'Unassigned Lead',
            members_count: membersCount || 4,
          };
        });
        setTeams(mappedTeams);
      } else {
        setTeams(fallbackTeams);
      }
    } catch (err) {
      console.error('Error fetching teams:', err);
      setTeams(fallbackTeams);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadTeamsData();
  }, []);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !user) return;

    setIsSubmitting(true);
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('teams')
          .insert([
            {
              name: teamName.trim(),
              description: teamDesc.trim(),
              lead_id: selectedLeadId || null,
              created_by: user.id,
            },
          ])
          .select()
          .single();

        if (!error && data) {
          const lead = profiles.find((p) => p.id === selectedLeadId);
          const newTeam: Team = {
            id: data.id,
            name: data.name,
            description: data.description,
            lead_id: data.lead_id,
            lead_name: lead?.full_name || 'Assigned Lead',
            members_count: 1,
          };
          setTeams((prev) => [newTeam, ...prev]);
        }
      } catch (err) {
        console.error('Failed to create team:', err);
      }
    } else {
      const newTeam: Team = {
        id: `team-${Date.now()}`,
        name: teamName.trim(),
        description: teamDesc.trim(),
        lead_name: 'Assigned Team Lead',
        members_count: 1,
      };
      setTeams((prev) => [newTeam, ...prev]);
    }

    setTeamName('');
    setTeamDesc('');
    setSelectedLeadId('');
    setIsSubmitting(false);
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-brand-700 uppercase tracking-wider bg-brand-50 px-2 py-0.5 rounded border border-brand-200/60">
              HFCL Limited
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-slate-500">{teams.length} Active Teams</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <Users className="w-6 h-6 text-brand-600" />
            HFCL Department & Engineering Teams
          </h1>
        </div>

        {isManagerOrAdmin && (
          <Button
            variant="primary"
            size="md"
            className="shadow-soft font-semibold text-xs"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowCreateModal(true)}
          >
            Create New Team
          </Button>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {teams.map((team) => (
          <Card key={team.id} hoverEffect className="space-y-4 flex flex-col justify-between p-5 border border-slate-200/80">
            <CardHeader className="p-0 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="primary" dot>
                  Active Team
                </Badge>
                <span className="text-xs font-bold text-slate-500">
                  {team.members_count} Employees
                </span>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 shrink-0 font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 leading-tight">
                    {team.name}
                  </CardTitle>
                </div>
              </div>

              <CardDescription className="text-xs leading-relaxed text-slate-500">
                {team.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0 pt-3 space-y-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                    Team Lead
                  </span>
                  <span className="font-bold text-slate-800">{team.lead_name}</span>
                </div>
                <Badge variant="neutral">Verified</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-600" />
                Create New HFCL Team
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Team Name</label>
                <Input
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. 5G Hardware Division"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description & Focus</label>
                <Input
                  value={teamDesc}
                  onChange={(e) => setTeamDesc(e.target.value)}
                  placeholder="e.g. PCB layout, RF testing, assembly"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Assign Team Lead</label>
                <select
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
                >
                  <option value="">Select Team Lead from Employees...</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.role === 'Manager' ? 'Manager' : p.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                  Create Team
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const fallbackTeams: Team[] = [
  { id: 't-1', name: 'Hardware Team', description: 'PCB Layout, RF Circuitry & Power Electronics', lead_name: 'Hardware Lead', members_count: 12 },
  { id: 't-2', name: 'Mechanical Team', description: 'Enclosure CAD Design & Thermal Analysis', lead_name: 'Mechanical Lead', members_count: 9 },
  { id: 't-3', name: 'Embedded Team', description: 'Microcontroller RTOS Firmware & Device Drivers', lead_name: 'Firmware Lead', members_count: 14 },
  { id: 't-4', name: 'Quality Assurance (QA)', description: 'Hardware EMI/EMC & Reliability Testing', lead_name: 'QA Lead', members_count: 8 },
];
