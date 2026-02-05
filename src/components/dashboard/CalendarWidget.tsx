import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { EVENT_TYPE_LABELS } from '@/types/calendar';
import { useNavigate } from 'react-router-dom';

export const CalendarWidget = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const navigate = useNavigate();
  
  const { events, isLoading, getEventsForDate, getEventDates } = useCalendarEvents(currentMonth);
  
  const eventDates = getEventDates();
  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get day of week for the first day (0 = Sunday)
  const startDay = monthStart.getDay();
  const paddingDays = Array(startDay).fill(null);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const handleEventClick = (orderNoteId: string | null) => {
    if (orderNoteId) {
      navigate('/order-notes');
    }
  };

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarIcon className="w-4 h-4 text-primary" />
          Order Calendar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Calendar Grid */}
          <div className="flex-1">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-sm font-medium">
                {format(currentMonth, 'MMMM yyyy')}
              </h3>
              <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs text-muted-foreground font-medium py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {paddingDays.map((_, i) => (
                <div key={`pad-${i}`} className="aspect-square" />
              ))}
              {days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayEvents = eventDates[dateStr];
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());

                return (
                  <button
                    key={day.toString()}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "aspect-square flex flex-col items-center justify-center rounded-md text-sm relative transition-colors",
                      "hover:bg-accent",
                      isSelected && "bg-primary text-primary-foreground hover:bg-primary",
                      isToday && !isSelected && "border border-primary",
                      !isSameMonth(day, currentMonth) && "text-muted-foreground opacity-50"
                    )}
                  >
                    <span>{format(day, 'd')}</span>
                    {dayEvents && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dayEvents.order_start && (
                          <span className="w-1.5 h-1.5 rounded-full bg-success" />
                        )}
                        {dayEvents.delivery && (
                          <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                        )}
                        {dayEvents.milestone && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-success" />
                <span>Order Start</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                <span>Delivery</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span>Milestone</span>
              </div>
            </div>
          </div>

          {/* Events Panel */}
          <div className="lg:w-64 border-t lg:border-t-0 lg:border-l pt-4 lg:pt-0 lg:pl-4">
            <h4 className="text-sm font-medium mb-3">
              {selectedDate 
                ? format(selectedDate, 'MMM d, yyyy')
                : 'Select a date'
              }
            </h4>
            <ScrollArea className="h-48">
              {selectedDate && selectedEvents.length === 0 && (
                <p className="text-sm text-muted-foreground">No events on this day</p>
              )}
              {selectedEvents.map(event => (
                <div
                  key={event.id}
                  onClick={() => handleEventClick(event.order_note_id)}
                  className={cn(
                    "p-2 rounded-md mb-2 text-sm cursor-pointer hover:opacity-80 transition-opacity",
                    event.event_type === 'order_start' && "bg-success/10 border border-success/20",
                    event.event_type === 'delivery' && "bg-destructive/10 border border-destructive/20",
                    event.event_type === 'milestone' && "bg-primary/10 border border-primary/20"
                  )}
                >
                  <div className="font-medium truncate">{event.title}</div>
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "mt-1 text-xs",
                      event.event_type === 'order_start' && "bg-success/20 text-success",
                      event.event_type === 'delivery' && "bg-destructive/20 text-destructive",
                      event.event_type === 'milestone' && "bg-primary/20 text-primary"
                    )}
                  >
                    {EVENT_TYPE_LABELS[event.event_type]}
                  </Badge>
                </div>
              ))}
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
