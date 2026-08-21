'use client';

import { useMemo, useRef, useState, type DragEvent } from 'react';
import type { Interview } from '@/lib/api/interviewApi';
import { colors } from '@/lib/theme/colors';

const HOUR_START = 8;
const HOUR_END = 20;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const ROW_H = 52;

type Props = {
  mode: 'week' | 'month';
  interviews: Interview[];
  anchorDate: Date;
  onAnchorChange: (date: Date) => void;
  onReschedule: (interviewId: string, startsAt: Date, endsAt: Date) => Promise<void> | void;
  onSlotClick?: (startsAt: Date) => void;
  onSelectInterview?: (interview: Interview) => void;
  busy?: boolean;
};

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function formatHour(h: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${ampm}`;
}

function durationMs(interview: Interview): number {
  const start = new Date(interview.startsAt).getTime();
  const end = new Date(interview.endsAt).getTime();
  const ms = end - start;
  return Number.isFinite(ms) && ms > 0 ? ms : 60 * 60 * 1000;
}

export default function InterviewCalendar({
  mode,
  interviews,
  anchorDate,
  onAnchorChange,
  onReschedule,
  onSlotClick,
  onSelectInterview,
  busy,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragDurationRef = useRef(60 * 60 * 1000);

  const scheduled = useMemo(
    () => interviews.filter((i) => i.status === 'scheduled' || i.status === 'rescheduled'),
    [interviews]
  );

  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const monthLabel = anchorDate.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const weekLabel = `${weekDays[0].toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} – ${weekDays[6].toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;

  const monthCells = useMemo(() => {
    const first = startOfMonth(anchorDate);
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [anchorDate]);

  const goPrev = () => {
    if (mode === 'week') onAnchorChange(addDays(anchorDate, -7));
    else onAnchorChange(new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 1, 1));
  };

  const goNext = () => {
    if (mode === 'week') onAnchorChange(addDays(anchorDate, 7));
    else onAnchorChange(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 1));
  };

  const goToday = () => onAnchorChange(new Date());

  const handleDragStart = (interview: Interview, event: DragEvent) => {
    setDraggingId(interview.id);
    dragDurationRef.current = durationMs(interview);
    event.dataTransfer.setData('text/interview-id', interview.id);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOnWeek = async (day: Date, hour: number, event: DragEvent) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/interview-id') || draggingId;
    setDraggingId(null);
    if (!id) return;

    const startsAt = new Date(day);
    startsAt.setHours(hour, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + dragDurationRef.current);
    await onReschedule(id, startsAt, endsAt);
  };

  const handleDropOnMonthDay = async (day: Date, event: DragEvent) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/interview-id') || draggingId;
    setDraggingId(null);
    if (!id) return;

    const interview = scheduled.find((i) => i.id === id);
    if (!interview) return;

    const prevStart = new Date(interview.startsAt);
    const startsAt = new Date(day);
    startsAt.setHours(prevStart.getHours(), prevStart.getMinutes(), 0, 0);
    const endsAt = new Date(startsAt.getTime() + durationMs(interview));
    await onReschedule(id, startsAt, endsAt);
  };

  return (
    <div
      className="overflow-hidden rounded-2xl border border-[#EEF0F8] bg-white"
      style={{ fontFamily: 'var(--font-poppins)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF0F8] px-4 py-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: colors.navy }}>
            {mode === 'week' ? weekLabel : monthLabel}
          </p>
          <p className="text-[11px]" style={{ color: colors.muted }}>
            Drag interviews to reschedule · click empty slot to schedule
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-[#E5E7EE] px-3 py-1.5 text-xs font-medium hover:bg-[#F7F8FE]"
            style={{ color: colors.navy }}
          >
            Today
          </button>
          <button
            type="button"
            onClick={goPrev}
            className="rounded-lg border border-[#E5E7EE] px-2.5 py-1.5 text-xs hover:bg-[#F7F8FE]"
            style={{ color: colors.navy }}
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg border border-[#E5E7EE] px-2.5 py-1.5 text-xs hover:bg-[#F7F8FE]"
            style={{ color: colors.navy }}
            aria-label="Next"
          >
            ›
          </button>
        </div>
      </div>

      {mode === 'week' ? (
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div
              className="grid border-b border-[#EEF0F8]"
              style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}
            >
              <div className="border-r border-[#EEF0F8]" />
              {weekDays.map((day) => {
                const today = isSameDay(day, new Date());
                return (
                  <div
                    key={day.toISOString()}
                    className="border-r border-[#EEF0F8] px-2 py-2 text-center last:border-r-0"
                  >
                    <p className="text-[10px] uppercase" style={{ color: colors.muted }}>
                      {day.toLocaleDateString(undefined, { weekday: 'short' })}
                    </p>
                    <p
                      className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                        today ? 'bg-[#202871] text-white' : ''
                      }`}
                      style={today ? undefined : { color: colors.navy }}
                    >
                      {day.getDate()}
                    </p>
                  </div>
                );
              })}
            </div>

            <div
              className="grid"
              style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}
            >
              <div className="border-r border-[#EEF0F8]">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="border-b border-[#F4F5FB] pr-2 text-right text-[10px]"
                    style={{ height: ROW_H, color: colors.muted }}
                  >
                    {formatHour(h)}
                  </div>
                ))}
              </div>

              {weekDays.map((day) => {
                const dayEvents = scheduled.filter((i) =>
                  isSameDay(new Date(i.startsAt), day)
                );
                return (
                  <div
                    key={day.toISOString()}
                    className="relative border-r border-[#EEF0F8] last:border-r-0"
                    style={{ height: HOURS.length * ROW_H }}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="absolute left-0 right-0 border-b border-[#F4F5FB] hover:bg-[#F7F8FE]/60"
                        style={{ top: (h - HOUR_START) * ROW_H, height: ROW_H }}
                        onClick={() => {
                          const startsAt = new Date(day);
                          startsAt.setHours(h, 0, 0, 0);
                          onSlotClick?.(startsAt);
                        }}
                        onDrop={(e) => void handleDropOnWeek(day, h, e)}
                      />
                    ))}

                    {dayEvents.map((interview) => {
                      const start = new Date(interview.startsAt);
                      const end = new Date(interview.endsAt);
                      const startMin = Math.max(
                        minutesFromMidnight(start),
                        HOUR_START * 60
                      );
                      const endMin = Math.min(minutesFromMidnight(end), HOUR_END * 60);
                      const top =
                        ((startMin - HOUR_START * 60) / 60) * ROW_H;
                      const height = Math.max(((endMin - startMin) / 60) * ROW_H, 28);
                      const dragging = draggingId === interview.id;

                      return (
                        <button
                          key={interview.id}
                          type="button"
                          draggable={!busy}
                          onDragStart={(e) => handleDragStart(interview, e)}
                          onDragEnd={() => setDraggingId(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectInterview?.(interview);
                          }}
                          className={`absolute left-1 right-1 z-10 overflow-hidden rounded-lg border px-1.5 py-1 text-left shadow-sm transition ${
                            dragging ? 'opacity-50' : 'hover:brightness-95'
                          }`}
                          style={{
                            top,
                            height,
                            backgroundColor: '#F3E5F5',
                            borderColor: '#CE93D8',
                            color: '#6A1B9A',
                            cursor: busy ? 'default' : 'grab',
                          }}
                          title={`${interview.candidateName} — ${interview.jobTitle}`}
                        >
                          <span className="block truncate text-[11px] font-semibold">
                            {interview.candidateName}
                          </span>
                          <span className="block truncate text-[10px] opacity-80">
                            {start.toLocaleTimeString(undefined, {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3">
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] uppercase" style={{ color: colors.muted }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((day) => {
              const inMonth = day.getMonth() === anchorDate.getMonth();
              const today = isSameDay(day, new Date());
              const dayEvents = scheduled.filter((i) =>
                isSameDay(new Date(i.startsAt), day)
              );
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[88px] rounded-xl border p-1.5 transition ${
                    inMonth ? 'border-[#EEF0F8] bg-white' : 'border-transparent bg-[#FAFBFF]'
                  } ${today ? 'ring-1 ring-[#202871]' : ''}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => void handleDropOnMonthDay(day, e)}
                  onClick={() => {
                    const startsAt = new Date(day);
                    startsAt.setHours(10, 0, 0, 0);
                    onSlotClick?.(startsAt);
                  }}
                >
                  <p
                    className={`mb-1 text-xs font-medium ${today ? 'text-[#202871]' : ''}`}
                    style={{ color: inMonth ? colors.navy : colors.muted }}
                  >
                    {day.getDate()}
                  </p>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((interview) => (
                      <button
                        key={interview.id}
                        type="button"
                        draggable={!busy}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          handleDragStart(interview, e);
                        }}
                        onDragEnd={() => setDraggingId(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectInterview?.(interview);
                        }}
                        className="block w-full truncate rounded-md px-1 py-0.5 text-left text-[10px] font-medium"
                        style={{
                          backgroundColor: '#F3E5F5',
                          color: '#6A1B9A',
                          cursor: busy ? 'default' : 'grab',
                          opacity: draggingId === interview.id ? 0.5 : 1,
                        }}
                      >
                        {new Date(interview.startsAt).toLocaleTimeString(undefined, {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}{' '}
                        {interview.candidateName.split(' ')[0]}
                      </button>
                    ))}
                    {dayEvents.length > 3 ? (
                      <p className="text-[10px]" style={{ color: colors.muted }}>
                        +{dayEvents.length - 3} more
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
