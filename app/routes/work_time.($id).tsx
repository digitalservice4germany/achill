import {
  ActionFunctionArgs,
  TypedResponse,
  json,
  redirect,
} from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import moment from "moment";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import { ZodError } from "zod";
import {
  DAYS_OF_WEEK,
  type PersonioAttendance,
} from "~/apis/personio/Personio.types";
import {
  deleteAttendance,
  patchAttendance,
  postAttendance,
} from "~/apis/personio/PersonioApiController";
import { TimeInput } from "~/components/common/TimeInput";
import { minutesToTime } from "~/utils/dateTimeUtils";
import { workTimeFormDataSchema } from "~/utils/workTimeFormValidator";
import { calculateWorkTimeFromStrings } from "~/utils/calculateWorkTime";

type ActionResponse =
  | (PersonioAttendance & { success: boolean })
  | { id: number; success: boolean }
  | ZodError<any>;
export async function action({
  request,
  params,
}: ActionFunctionArgs): Promise<TypedResponse<ActionResponse>> {
  const formData = await request.formData();
  const id = params.id;

  try {
    const { date, startTime, breakTime, endTime, _action } =
      workTimeFormDataSchema.parse(Object.fromEntries(formData.entries()));

    switch (_action) {
      case "POST":
        return await postAttendance(
          request,
          date,
          startTime,
          endTime,
          breakTime,
        );
      case "PATCH":
        if (!id) {
          throw new Response("Attendance ID is required.", { status: 400 });
        }
        return await patchAttendance(id, date, startTime, endTime, breakTime);
      case "DELETE":
        if (!id) {
          throw new Response("Attendance ID is required.", { status: 400 });
        }
        return await deleteAttendance(id);
      default:
        throw new Response("Method Not Allowed", { status: 405 });
    }
  } catch (e) {
    if (e instanceof ZodError) {
      return json(e, { status: 422 });
    }
    if (e instanceof Error && e.message === "Invalid credentials") {
      console.error("Personio auth failed", e);
      throw redirect("/login");
    }
    throw e;
  }
}

const DEFAULT_START_TIME = "09:00";
const DEFAULT_BREAK_TIME = "01:00";

function getEndTime(workTime: number) {
  // calculate end time based on daily work time from personio
  const momentStartTime = moment(DEFAULT_START_TIME, "HH:mm");
  const momentBreakTime = moment(DEFAULT_BREAK_TIME, "HH:mm");
  const momentWorkTime = moment(minutesToTime(workTime * 60), "HH:mm");

  return momentStartTime
    .add(momentBreakTime.hours(), "hours")
    .add(momentBreakTime.minutes(), "minutes")
    .add(momentWorkTime.hours(), "hours")
    .add(momentWorkTime.minutes(), "minutes")
    .format("HH:mm");
}

interface Props {
  selectedDate: Date;
  workingHours: Record<string, number>;
  attendances: PersonioAttendance[];
  setAttendances: Dispatch<SetStateAction<PersonioAttendance[]>>;
}
export function WorkTimeForm({
  selectedDate,
  workingHours,
  attendances,
  setAttendances,
}: Props) {
  const fetcher = useFetcher<typeof action>();

  const attendanceOfSelectedDate = attendances.find(
    (attendance) =>
      attendance.date === moment(selectedDate).format("YYYY-MM-DD"),
  );

  const workTime =
    workingHours[DAYS_OF_WEEK[moment(selectedDate).weekday() - 1]];

  const [startTime, setStartTime] = useState(
    attendanceOfSelectedDate
      ? attendanceOfSelectedDate.startTime
      : DEFAULT_START_TIME,
  );
  const [breakTime, setBreakTime] = useState(
    attendanceOfSelectedDate
      ? minutesToTime(attendanceOfSelectedDate.breakTime)
      : DEFAULT_BREAK_TIME,
  );
  const [endTime, setEndTime] = useState(
    attendanceOfSelectedDate
      ? attendanceOfSelectedDate.endTime
      : getEndTime(workTime),
  );
  const [worktimeLive, setWorktimeLive] = useState(
    calculateWorkTimeFromStrings(startTime, breakTime, endTime),
  );
  useEffect(() => {
    // here
    setWorktimeLive(
      calculateWorkTimeFromStrings(startTime, breakTime, endTime),
    );
  }, [startTime, breakTime, endTime]);
  const [isEdit, setIsEdit] = useState(!attendanceOfSelectedDate);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  function setIsEditPreventSubmit(event: any, value: boolean) {
    event.preventDefault();
    setIsEdit(value);
  }

  useEffect(() => {
    if (fetcher.state !== "loading" || !fetcher.data) return;
    if ("issues" in fetcher.data) {
      const errors = fetcher.data.issues.reduce(
        (errors, issue) => ({
          ...errors,
          [issue.path[0]]: issue.message,
        }),
        {},
      );
      setValidationErrors(errors);
    } else if (
      fetcher.state === "loading" &&
      fetcher.data?.success &&
      fetcher.formData
    ) {
      const submittedAttendance = fetcher.data;

      switch (fetcher.formData.get("_action")) {
        case "POST":
          setIsEdit(false);
          setAttendances([
            ...attendances,
            submittedAttendance as PersonioAttendance,
          ]);
          break;
        case "PATCH":
          setIsEdit(false);
          setAttendances(
            attendances.map((attendance) =>
              attendance.id === submittedAttendance.id
                ? (submittedAttendance as PersonioAttendance)
                : attendance,
            ),
          );
          break;
        case "DELETE":
          setIsEdit(true);
          setAttendances(
            attendances.filter(
              (attendance) => attendance.id !== submittedAttendance.id,
            ),
          );
          break;
        default:
          break;
      }
    }
  }, [fetcher.state]);

  function setTime(time: string, setter: Dispatch<SetStateAction<string>>) {
    setter(time);
    setValidationErrors({});
  }

  return (
    <fetcher.Form
      method="POST"
      action={`/work_time/${attendanceOfSelectedDate?.id ?? ""}`}
      id="work-time-form"
      className="relative flex justify-between rounded-lg bg-gray-100 p-4 shadow-lg"
    >
      {fetcher.state === "submitting" && (
        <div className="disabled-overlay"></div>
      )}
      <div className="flex flex-col md:flex-row gap-3 md:gap-0 md:flex-grow justify-between self-start">
        <TimeInput
          name="startTime"
          time={startTime}
          onChange={(time) => setTime(time, setStartTime)}
          label="Start time"
          readOnly={!isEdit}
          hasError={!!validationErrors.allTimes}
        />
        <TimeInput
          name="breakTime"
          time={breakTime}
          onChange={(time) => setTime(time, setBreakTime)}
          label="Break"
          readOnly={!isEdit}
          hasError={!!validationErrors.allTimes}
        />
        <TimeInput
          name="endTime"
          time={endTime}
          onChange={(time) => setTime(time, setEndTime)}
          label="End time"
          readOnly={!isEdit}
          hasError={!!validationErrors.allTimes}
        />
      </div>
      <input
        name="date"
        value={moment(selectedDate).format("YYYY-MM-DD")}
        readOnly
        hidden
      />
      {Object.entries(validationErrors).length > 0 && (
        <ul className="font-bold text-red-600 absolute right-4">
          {Object.entries(validationErrors).map(([key, value]) => (
            <li key={key}>&#x26A0; {value}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-col lg:flex-row gap-2 self-end justify-end items-center basis-40 lg:basis-60">
        <div className="flex min-w-[6ch] justify-center px-2 py-2">
          <p
            id="workhours-live-display"
            className="text-base font-medium text-black"
          >
            {worktimeLive}
          </p>
        </div>
        {attendanceOfSelectedDate ? (
          isEdit ? (
            <>
              <button
                type="reset"
                onClick={(e) => setIsEditPreventSubmit(e, false)}
                className="tracky-btn danger"
              >
                Cancel
              </button>
              <button name="_action" value="PATCH" className="tracky-btn">
                Update
              </button>
            </>
          ) : (
            <>
              <button
                name="_action"
                value="DELETE"
                className="tracky-btn danger"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={(e) => setIsEditPreventSubmit(e, true)}
                className="tracky-btn"
              >
                Edit
              </button>
            </>
          )
        ) : (
          <button name="_action" value="POST" className="tracky-btn">
            Save
          </button>
        )}
      </div>
    </fetcher.Form>
  );
}
