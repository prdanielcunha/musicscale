import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateGoogleCalendarUrl,
  downloadCalendarICS,
  resolveScaleDurationMinutes,
  convertScaleToCalendarEvent,
  generateCalendarICS,
  CalendarEventData,
  CalendarScaleData
} from '../../utils/calendar';

describe('Calendar Utilities (utils/calendar.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockEvent: CalendarEventData = {
    id: 'org1_scale123',
    title: 'Culto de Adoração, Música & Arte',
    start: new Date('2026-12-25T19:00:00Z'),
    end: new Date('2026-12-25T21:00:00Z'),
    description: 'Escala do Ministério de Música.\n\nLocal: Templo Principal\\Sala 2',
    location: 'Templo Principal; São Paulo'
  };

  describe('generateGoogleCalendarUrl', () => {
    it('generates correct Google Calendar template URL with encoded fields', () => {
      const url = generateGoogleCalendarUrl(mockEvent);
      expect(url).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE');
      expect(url).toContain('text=Culto%20de%20Adora%C3%A7%C3%A3o%2C%20M%C3%BAsica%20%26%20Arte');
      expect(url).toContain('dates=20261225T190000Z/20261225T210000Z');
    });
  });

  describe('downloadCalendarICS', () => {
    it('successfully triggers file download by building an ICS blob and anchor element', () => {
      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-uuid');
      const mockRevokeObjectURL = vi.fn();
      globalThis.URL.createObjectURL = mockCreateObjectURL;
      globalThis.URL.revokeObjectURL = mockRevokeObjectURL;

      const anchorMock = document.createElement('a');
      anchorMock.click = vi.fn();
      
      const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {
        return anchorMock;
      });
      const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {
        return anchorMock;
      });

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return anchorMock;
        }
        return originalCreateElement(tagName);
      });

      downloadCalendarICS(mockEvent);

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(anchorMock.href).toBe('blob:http://localhost/mock-uuid');
      expect(anchorMock.download).toBe('culto_de_adoração,_música_&_arte.ics');
      expect(anchorMock.click).toHaveBeenCalled();
    });
  });

  describe('generateCalendarICS', () => {
    it('generates correct ICS format with proper escaping and formatting', () => {
      const ics = generateCalendarICS(mockEvent);
      expect(ics).toContain('BEGIN:VCALENDAR\r\nVERSION:2.0');
      expect(ics).toContain('UID:scale_org1_scale123@musicscale.com');
      expect(ics).toContain('DTSTART:20261225T190000Z');
      expect(ics).toContain('DTEND:20261225T210000Z');
      expect(ics).toContain('SUMMARY:Culto de Adoração\\, Música & Arte'); // commas escaped
      expect(ics).toContain('DESCRIPTION:Escala do Ministério de Música.\\n\\nLocal: Templo Principal\\\\Sala 2');
      expect(ics).toContain('LOCATION:Templo Principal\\; São Paulo');
      expect(ics).toContain('END:VEVENT\r\nEND:VCALENDAR');
    });

    it('generates correct ICS format for multiple events', () => {
      const mockEvent2: CalendarEventData = {
        id: 'org1_scale456',
        title: 'Culto Especial',
        start: new Date('2026-12-31T22:00:00Z'),
        end: new Date('2027-01-01T01:00:00Z'),
        description: 'Vigília de Ano Novo',
        location: 'Templo Sede'
      };

      const ics = generateCalendarICS([mockEvent, mockEvent2]);
      expect(ics).toContain('BEGIN:VCALENDAR\r\nVERSION:2.0');
      
      // Check first event
      expect(ics).toContain('UID:scale_org1_scale123@musicscale.com');
      expect(ics).toContain('SUMMARY:Culto de Adoração\\, Música & Arte');
      
      // Check second event
      expect(ics).toContain('UID:scale_org1_scale456@musicscale.com');
      expect(ics).toContain('SUMMARY:Culto Especial');
      expect(ics).toContain('DESCRIPTION:Vigília de Ano Novo');
      expect(ics).toContain('LOCATION:Templo Sede');
      
      // Ends with calendar tag
      expect(ics.endsWith('END:VCALENDAR')).toBe(true);
    });

    it('handles Brazilian timezone (America/Sao_Paulo) conversion correctly', () => {
      // Mock event representing local time in Brazil
      const localDateStr = '2026-12-25';
      const localTimeStr = '19:00'; // 19:00 local time
      
      const scale: CalendarScaleData = {
        id: 'scale-tz',
        organizationId: 'org-tz',
        date: localDateStr,
        time: localTimeStr,
        durationMinutes: 120,
        eventType: { name: 'Culto Especial' }
      };
      
      const event = convertScaleToCalendarEvent(scale);
      expect(event).not.toBeNull();
      
      // Assert that start date matches local hour inputs, formatting explicitly for America/Sao_Paulo
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      });
      const parts = formatter.formatToParts(event?.start);
      const val = (type: string) => parts.find(p => p.type === type)?.value;
      
      expect(val('year')).toBe('2026');
      expect(val('month')).toBe('12');
      expect(val('day')).toBe('25');
      let hourStr = val('hour');
      if (hourStr === '24') hourStr = '00';
      expect(Number(hourStr)).toBe(19);
      expect(Number(val('minute'))).toBe(0);
    });

    it('generates stable UID when id is missing', () => {
      const eventWithoutId = { ...mockEvent, id: '' };
      const ics = generateCalendarICS(eventWithoutId);
      expect(ics).toMatch(/UID:scale_[a-z0-9]+@musicscale\.com/);
    });

    it('handles empty location', () => {
      const eventEmptyLoc = { ...mockEvent, location: '' };
      const ics = generateCalendarICS(eventEmptyLoc);
      expect(ics).toContain('LOCATION:');
    });
  });

  describe('resolveScaleDurationMinutes', () => {
    it('resolves defaults and custom durations', () => {
      expect(resolveScaleDurationMinutes(null)).toBe(120);
      expect(resolveScaleDurationMinutes(90)).toBe(90);
      expect(resolveScaleDurationMinutes('45')).toBe(45);
      expect(resolveScaleDurationMinutes('abc')).toBe(120);
    });
  });

  describe('convertScaleToCalendarEvent', () => {
    it('handles valid scales, missing dates, custom duration, etc.', () => {
      const emptyScale = {} as CalendarScaleData;
      expect(convertScaleToCalendarEvent(emptyScale)).toBeNull();

      const scale: CalendarScaleData = {
        id: 'scale-1',
        organizationId: 'org-1',
        date: '2026-08-15',
        time: '10:30',
        durationMinutes: 90,
        eventType: { name: 'Culto' },
        eventName: { name: 'Manhã' },
        location: { name: 'Auditório' },
        bandScale: {
          assignments: [
            { user: { displayName: 'Felipe' }, instrument: { name: 'Bateria' } }
          ]
        },
        songs: [
          { title: 'Amazing Grace', artist: 'John Newton' }
        ]
      };
      
      const event = convertScaleToCalendarEvent(scale);
      expect(event).not.toBeNull();
      expect(event?.title).toBe('Culto Manhã');
      expect(event?.description).toContain('Felipe: Bateria');
      expect(event?.description).toContain('Amazing Grace (John Newton)');
      expect(event?.location).toBe('Auditório');
    });
  });
});
