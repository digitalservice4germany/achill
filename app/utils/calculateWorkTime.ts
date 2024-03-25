import type { Time } from "./dateTimeUtils";
import { minutesToTime, timeToMinutes, timeSchema } from "./dateTimeUtils";
import moment from "moment";
import type { PersonioAttendance } from "~/apis/personio/Personio.types";

export function calculateWorkTimeFromAttendance(
  attendance: PersonioAttendance,
): string {
  return calculateWorkTime(
    attendance.startTime,
    attendance.breakTime,
    attendance.endTime,
  );
}

export function calculateWorkTimeFromStrings(
  startTime: String,
  breakTime: String,
  endTime: String,
): string {
  return calculateWorkTime(
    timeSchema.parse(startTime),
    timeSchema.transform((time) => timeToMinutes(time)).parse(breakTime),
    timeSchema.parse(endTime),
  );
}

export function calculateWorkTime(
  startTime: Time,
  breakTime: number,
  endTime: Time,
): string {
  const momentBreakTime = moment(minutesToTime(breakTime), "HH:mm");
  const momentStartTime = moment(startTime, "HH:mm");

  return moment(endTime, "HH:mm")
    .subtract(momentBreakTime.hours(), "hours")
    .subtract(momentBreakTime.minutes(), "minutes")
    .subtract(momentStartTime.hours(), "hours")
    .subtract(momentStartTime.minutes(), "minutes")
    .format("H:mm");
}
