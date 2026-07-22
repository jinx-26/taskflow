import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react';

const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const Calendar: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Schedule
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-brand-600">July 2026</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1">
            <CalendarIcon className="w-6 h-6 text-brand-600" />
            Calendar
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-soft-xs">
            <button className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-slate-800">July 2026</span>
            <button className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <Button
            variant="primary"
            size="md"
            className="shadow-soft font-semibold text-xs"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Event
          </Button>
        </div>
      </div>

      {/* Calendar Grid Preview */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-2 mb-2 text-center">
            {daysOfWeek.map((day) => (
              <div key={day} className="text-xs font-bold text-slate-400 py-2 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 31 }).map((_, i) => {
              const dayNum = i + 1;
              const isToday = dayNum === 22;
              const hasEvents = [15, 22, 23, 25, 28].includes(dayNum);

              return (
                <div
                  key={i}
                  className={`min-h-[90px] p-2 rounded-xl border transition-all flex flex-col justify-between ${
                    isToday
                      ? 'bg-brand-50/60 border-brand-300 ring-2 ring-brand-500/20'
                      : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        isToday
                          ? 'w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center'
                          : 'text-slate-700'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {isToday && (
                      <span className="text-[9px] font-bold text-brand-600 uppercase">Today</span>
                    )}
                  </div>

                  {hasEvents && (
                    <div className="space-y-1 mt-1">
                      <div className="text-[10px] font-semibold bg-brand-100 text-brand-800 p-1 rounded truncate">
                        Sprint Audit
                      </div>
                      {dayNum === 22 && (
                        <div className="text-[10px] font-semibold bg-amber-100 text-amber-800 p-1 rounded truncate">
                          Release v2.0
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
