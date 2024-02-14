import moment from "moment";
import { PersonioAttendance } from "~/apis/personio/Personio.types";
import { getItemForEventType } from "~/utils/calendarEventUtils";
import {
  datesEqual,
  getWeekDaysFor,
  minutesToTime,
} from "~/utils/dateTimeUtils";
import { convertFloatTimeToHHMM } from "~/utils/dateTimeUtils";
import { TransformedCalendarEvent } from "~/utils/transformCalendarEvents";

interface Props {
  timesAndEventsOfSelectedWeek: {
    hours: number;
    events: TransformedCalendarEvent[];
  }[];
  selectedDate: Date;
  onSelectDate: (newDate: Date) => unknown;
  attendancesOfSelectedWeek: (PersonioAttendance | undefined)[];
}

export function WeekTable({
  timesAndEventsOfSelectedWeek,
  selectedDate,
  onSelectDate,
  attendancesOfSelectedWeek,
}: Props) {
  const weekdays = ["M", "T", "W", "T", "F"];
  const selectedWeek = getWeekDaysFor(selectedDate);

  function getDateClassNames(index: number, selectedDate: Date) {
    let dateClasses = "flex h-8 w-8 items-center justify-center rounded-full ";
    let date = selectedWeek[index];

    if (datesEqual(date, new Date())) {
      dateClasses += "outline-none ring-2 ring-black ring-offset-2 ";
    }

    if (datesEqual(date, selectedDate)) {
      dateClasses += "bg-blue-600 text-white hover:bg-blue-700 ";
    } else {
      dateClasses += "text-black hover:bg-[#B8BDC3] ";
    }

    return dateClasses;
  }

  function getIconForEvent(event: TransformedCalendarEvent) {
    if (event === undefined) {
      return undefined;
    }

    return getItemForEventType(event.type);
  }

  function calculateWorkTime(attendance: PersonioAttendance): string {
    const momentBreakTime = moment(
      minutesToTime(attendance.breakTime),
      "HH:mm",
    );
    const momentStartTime = moment(attendance.start_time, "HH:mm");

    return moment(attendance.end_time, "HH:mm")
      .subtract(momentBreakTime.hours(), "hours")
      .subtract(momentBreakTime.minutes(), "minutes")
      .subtract(momentStartTime.hours(), "hours")
      .subtract(momentStartTime.minutes(), "minutes")
      .format("HH:mm");
  }

  return (
    <div className="flex items-center justify-between">
      <table className="w-full">
        <thead>
          <tr>
            {weekdays.map((weekday, index) => (
              <th key={index}>
                <div className="flex w-full justify-center">
                  <p className="text-center text-base font-medium text-gray-600">
                    {weekday}
                  </p>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {selectedWeek.map((date, index) => (
              <td key={date.getTime()}>
                <div
                  className="h-full w-full"
                  data-testid={
                    ["btn-mon", "btn-tue", "btn-wed", "btn-thu", "btn-fri"][
                      index
                    ]
                  }
                  onClick={() => onSelectDate(date)}
                >
                  <div className="flex w-full cursor-pointer items-center justify-center rounded-full px-2 py-2 text-base font-medium">
                    <p className={getDateClassNames(index, selectedDate)}>
                      {date.getDate()}
                    </p>
                  </div>
                </div>
              </td>
            ))}
          </tr>
          <tr>
            {attendancesOfSelectedWeek.map((attendance, index) => (
              <td key={selectedWeek[index].getTime()}>
                <div
                  className="flex min-w-[6ch] cursor-pointer justify-center px-2 py-2"
                  onClick={() => onSelectDate(selectedWeek[index])}
                >
                  <p
                    data-testid={
                      [
                        "workhours-mon",
                        "workhours-tue",
                        "workhours-wed",
                        "workhours-thu",
                        "workhours-fri",
                      ][index]
                    }
                    className={`text-base font-medium ${
                      attendance ? "text-black" : "text-gray-500"
                    }`}
                  >
                    {attendance && calculateWorkTime(attendance)}
                    {!attendance && 0}
                  </p>
                </div>
              </td>
            ))}
          </tr>
          <tr>
            {timesAndEventsOfSelectedWeek.map((data, index) => (
              <td key={selectedWeek[index].getTime()}>
                <div
                  className="flex min-w-[6ch] cursor-pointer justify-center px-2 py-2"
                  onClick={() => onSelectDate(selectedWeek[index])}
                >
                  {data.events.length && getIconForEvent(data.events[0]) ? (
                    <span
                      data-testid={
                        [
                          "event-mon",
                          "event-tue",
                          "event-wed",
                          "event-thu",
                          "event-fri",
                        ][index]
                      }
                      className="material-symbols-outlined"
                    >
                      {getIconForEvent(data.events[0])}
                    </span>
                  ) : (
                    <p
                      data-testid={
                        [
                          "hours-mon",
                          "hours-tue",
                          "hours-wed",
                          "hours-thu",
                          "hours-fri",
                        ][index]
                      }
                      className={`text-base font-medium ${
                        data.hours == 0 ? "text-gray-500" : "text-blue-600"
                      }`}
                    >
                      {convertFloatTimeToHHMM(data.hours)}
                    </p>
                  )}
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
