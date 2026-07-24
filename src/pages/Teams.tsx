import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Users, Plus, Cpu, Wrench, Binary, Network, ShieldCheck } from 'lucide-react';

const hfclTeams = [
  {
    id: 'team-hardware',
    name: 'Hardware Team',
    leadTitle: 'Hardware Engineering Lead',
    membersCount: 12,
    activeTasks: 24,
    icon: Cpu,
    focus: 'PCB Layout, RF Circuitry, High-Speed Digital & Power Electronics Design',
  },
  {
    id: 'team-mechanical',
    name: 'Mechanical Team',
    leadTitle: 'Mechanical Design Lead',
    membersCount: 9,
    activeTasks: 16,
    icon: Wrench,
    focus: 'Rugged Enclosure Design, Thermal Analysis, 3D CAD Modeling & IP Code Testing',
  },
  {
    id: 'team-embedded',
    name: 'Embedded Team',
    leadTitle: 'Embedded Firmware Lead',
    membersCount: 14,
    activeTasks: 28,
    icon: Binary,
    focus: 'Microcontroller Firmware, Real-Time OS (RTOS), BSP & Hardware Device Drivers',
  },
  {
    id: 'team-solution-eng',
    name: 'Solution Engineering Team',
    leadTitle: 'Solutions & Telecom Lead',
    membersCount: 10,
    activeTasks: 19,
    icon: Network,
    focus: 'Telecom Architecture, Field Deployment, Network System Integration & Client Demos',
  },
  {
    id: 'team-qa',
    name: 'Quality Assurance (QA) Team',
    leadTitle: 'Hardware QA & Testing Lead',
    membersCount: 8,
    activeTasks: 15,
    icon: ShieldCheck,
    focus: 'Hardware Reliability Testing, EMI/EMC Compliance, Automated Firmware QA & Field Audits',
  },
];

export const Teams: React.FC = () => {
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
            <span className="text-xs font-semibold text-slate-500">5 Active Engineering Teams</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <Users className="w-6 h-6 text-brand-600" />
            HFCL Engineering Teams
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {hfclTeams.map((team) => {
          const TeamIcon = team.icon;
          return (
            <Card key={team.id} hoverEffect className="space-y-4 flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="primary" dot>
                    Active
                  </Badge>
                  <span className="text-xs font-semibold text-slate-500">
                    {team.membersCount} Members
                  </span>
                </div>

                <div className="flex items-center gap-2.5 pt-2">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 shrink-0">
                    <TeamIcon className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base font-bold text-slate-900 leading-tight">
                    {team.name}
                  </CardTitle>
                </div>

                <CardDescription className="pt-2 text-xs leading-relaxed text-slate-500">
                  {team.focus}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0 space-y-3">
                <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">
                      Role Title
                    </span>
                    <span className="font-semibold text-slate-800">{team.leadTitle}</span>
                  </div>
                  <Badge variant="neutral">{team.activeTasks} Tasks</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
