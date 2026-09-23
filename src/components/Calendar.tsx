import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarProps {
  events: {
    id: string;
    startDate?: string;
    endDate?: string;
    date?: string; // Fallback for single date events
    title: string;
    type?: string;
    color?: string;
  }[];
  onEventClick?: (id: string) => void;
  rowHeight?: string;
}

export default function Calendar({ events, onEventClick, rowHeight = '120px' }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const parseDate = (dateStr: string | undefined) => {
    if (!dateStr) return null;
    
    // Handle DD/MM/YYYY
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
    }
    
    // Handle YYYY-MM-DD - forcing local interpretation
    if (dateStr.includes('-') && dateStr.split('-').length === 3) {
       const parts = dateStr.split(' ')[0].split('-');
       const year = parseInt(parts[0], 10);
       const month = parseInt(parts[1], 10) - 1;
       const day = parseInt(parts[2], 10);
       return new Date(year, month, day);
    }
    
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = [];
  const numDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);

  // Previous month days
  const prevMonthDays = daysInMonth(year, month - 1);
  for (let i = startDay - 1; i >= 0; i--) {
    days.push({ day: prevMonthDays - i, currentMonth: false, date: new Date(year, month - 1, prevMonthDays - i) });
  }

  // Current month days
  for (let i = 1; i <= numDays; i++) {
    days.push({ day: i, currentMonth: true, date: new Date(year, month, i) });
  }

  // Next month days
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    days.push({ day: i, currentMonth: false, date: new Date(year, month + 1, i) });
  }

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));

  const getEventsForDay = (date: Date) => {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();

    return events.filter(e => {
      const start = parseDate(e.startDate || e.date);
      const end = parseDate(e.endDate || e.date);

      if (!start) return false;

      const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
      const endTime = end 
        ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).getTime()
        : new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999).getTime();

      return dayStart <= endTime && dayEnd >= startTime;
    }).map(e => {
      const start = parseDate(e.startDate || e.date)!;
      const end = parseDate(e.endDate || e.date) || start;
      
      const isStart = start.getDate() === date.getDate() && start.getMonth() === date.getMonth() && start.getFullYear() === date.getFullYear();
      const isEnd = end.getDate() === date.getDate() && end.getMonth() === date.getMonth() && end.getFullYear() === date.getFullYear();
      
      return { ...e, isStart, isEnd };
    });
  };

  return (
    <div className="bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden">
      <div className="p-4 border-b border-app-border flex items-center justify-between">
        <h2 className="text-lg font-semibold text-app-text">
          {monthNames[month]} {year}
        </h2>
        <div className="flex space-x-2">
          <button onClick={prevMonth} className="p-2 hover:bg-app-bg text-app-text-muted hover:text-app-text rounded-lg transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-app-bg text-app-text-muted hover:text-app-text rounded-lg transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-app-border">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
          <div key={d} className="p-2 text-center text-xs font-semibold text-app-text-muted uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      <div 
        className="grid grid-cols-7"
        style={{ gridAutoRows: rowHeight }}
      >
        {days.map((d, i) => {
          const dayEvents = getEventsForDay(d.date);
          const isToday = new Date().toDateString() === d.date.toDateString();

          return (
            <div 
              key={i} 
              className={`p-1 border-r border-b border-app-border flex flex-col ${
                d.currentMonth ? 'bg-app-surface' : 'bg-app-bg/50 text-app-text-muted/50'
              }`}
            >
              <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                isToday ? 'bg-primary text-white shadow-sm' : 'text-app-text'
              }`}>
                {d.day}
              </span>
              <div className="flex-1 space-y-0.5 overflow-hidden">
                {dayEvents.map(e => (
                  <div
                    key={e.id}
                    onClick={() => onEventClick?.(e.id)}
                    className={`
                      relative h-5 flex items-center px-1 cursor-pointer text-[9px] font-medium transition-all
                      ${e.color || 'bg-primary/10 text-primary border-primary/20'}
                      ${e.isStart ? 'rounded-l ml-1' : ''}
                      ${e.isEnd ? 'rounded-r mr-1' : ''}
                      ${!e.isStart && !e.isEnd ? 'border-l-0 border-r-0' : ''}
                      ${e.isStart || d.date.getDay() === 0 ? 'z-10' : 'text-transparent'}
                    `}
                    title={e.title}
                  >
                    <span className="truncate">
                      {(e.isStart || d.date.getDay() === 0) && e.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
