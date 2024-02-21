import { json } from "@remix-run/node";
import moment from "moment";
import { getSessionAndThrowIfInvalid } from "~/sessions.server";
import type { Time } from "~/utils/dateTimeUtils";
import {
  END_DATE,
  START_DATE,
  convertTimeStringToFloat,
  timeToMinutes,
} from "~/utils/dateTimeUtils";
import type {
  PersonioApiAttendance,
  PersonioApiEmployees,
  PersonioAttendance,
  PersonioEmployee,
} from "./Personio.types";

const PERSONIO_BASE_URL = "https://api.personio.de/v1";
const PERSONIO_AUTH_URL = `${PERSONIO_BASE_URL}/auth`;
const PERSONIO_EMPLOYEES_URL = `${PERSONIO_BASE_URL}/company/employees`;
const PERSONIO_ATTENDANCES_URL = `${PERSONIO_BASE_URL}/company/attendances`;
const PERSONIO_PARTNER_ID = "DIGITALSERVICE";
const DIGITALSERVICE_MAIL_DOMAIN = "digitalservice.bund.de";

async function getAuthToken(): Promise<string> {
  console.log("Loading new Personio auth token...");

  const response = await fetch(PERSONIO_AUTH_URL, {
    method: "POST",
    headers: {
      "X-Personio-Partner-ID": PERSONIO_PARTNER_ID,
    },
    body: JSON.stringify({
      client_id: process.env.PERSONIO_CLIENT_ID,
      client_secret: process.env.PERSONIO_CLIENT_SECRET,
    }),
  });

  console.log("[Personio API]", "POST", PERSONIO_AUTH_URL, response.status);

  const { success, data } = await response.json();

  if (!success) {
    console.error(
      "Couldn't load new Personio auth token! Is the client_id and client_secret still correct?",
    );
    throw new Error("Personio Api Auth Failed");
  }

  return data.token;
}

let authToken: Promise<string> | undefined;
async function fetchWithPersonioAuth(
  input: RequestInfo | URL,
  init?: RequestInit | undefined,
): Promise<Response> {
  if (authToken === undefined) {
    authToken = getAuthToken();
  }

  const fetchData = async (authToken: string) => {
    const response = await fetch(input, {
      ...init,
      headers: {
        Authorization: `Bearer ${authToken}`,
        "X-Personio-Partner-ID": PERSONIO_PARTNER_ID,
        ...init?.headers,
      },
    });
    console.log(
      "[Personio API]",
      init?.method ?? "GET",
      input.toString(),
      response.status,
    );
    return response;
  };

  const response = await fetchData(await authToken);
  if (response.status === 401) {
    authToken = getAuthToken();
    return fetchData(await authToken);
  }

  return response;
}

export async function getEmployeeDataByMail(
  username: string,
): Promise<PersonioEmployee> {
  const url = new URL(PERSONIO_EMPLOYEES_URL);
  const mailAddress = `${username}@${DIGITALSERVICE_MAIL_DOMAIN}`;
  url.searchParams.set("email", mailAddress);

  const response = await fetchWithPersonioAuth(url);
  const employeeData: PersonioApiEmployees = await response.json();

  const schedule =
    employeeData.data[0].attributes.work_schedule.value.attributes;
  return {
    personioId: employeeData.data[0].attributes.id.value,
    workingHours: {
      monday: convertTimeStringToFloat(schedule.monday),
      tuesday: convertTimeStringToFloat(schedule.tuesday),
      wednesday: convertTimeStringToFloat(schedule.wednesday),
      thursday: convertTimeStringToFloat(schedule.thursday),
      friday: convertTimeStringToFloat(schedule.friday),
    },
  };
}

export async function getAttendances(
  employeeId: number,
): Promise<PersonioAttendance[]> {
  async function _getAttendances(offset: number = 0, limit: number = 200) {
    const url = new URL(PERSONIO_ATTENDANCES_URL);
    url.searchParams.set("start_date", moment(START_DATE).format("YYYY-MM-DD"));
    url.searchParams.set("end_date", moment(END_DATE).format("YYYY-MM-DD"));
    url.searchParams.append("employees", employeeId.toString());
    url.searchParams.set("offset", offset.toString());
    url.searchParams.set("limit", limit.toString());

    const response = await fetchWithPersonioAuth(url);
    return (await response.json()) as PersonioApiAttendance;
  }

  const result = await _getAttendances(0);
  let data = result.data;

  if (result.metadata.total_pages > 1) {
    const result2 = await _getAttendances(200);

    if (result.metadata.total_pages > 2) {
      console.error(
        "There are more than 400 personio attendances, please adjust the pagination logic :)",
      );
    }

    data = [...data, ...result2.data];
  }

  return data.map(
    ({
      id,
      attributes: {
        date,
        start_time: startTime,
        end_time: endTime,
        break: breakTime,
        comment,
      },
    }) => ({ id, date, startTime, endTime, breakTime, comment }),
  );
}

export async function postAttendance(
  request: Request,
  date: string,
  startTime: Time,
  endTime: Time,
  breakTime: Time,
) {
  const session = await getSessionAndThrowIfInvalid(request);
  const employee = session.get("personioEmployee")?.personioId;

  const response = await fetchWithPersonioAuth(PERSONIO_ATTENDANCES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      attendances: [
        {
          employee,
          date,
          start_time: startTime,
          end_time: endTime,
          break: timeToMinutes(breakTime),
        },
      ],
    }),
  });

  const data = await response.json();
  if (!data.success) {
    return response;
  }

  return json(
    { success: true, id: data.data.id[0], date, startTime, endTime, breakTime },
    { status: 201 },
  );
}

export async function patchAttendance(
  attendanceId: string,
  date: string,
  startTime: Time,
  endTime: Time,
  breakTime: Time,
) {
  const response = await fetchWithPersonioAuth(
    `${PERSONIO_ATTENDANCES_URL}/${attendanceId}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        date,
        start_time: startTime,
        end_time: endTime,
        break: timeToMinutes(breakTime),
      }),
    },
  );

  const data = await response.json();
  if (!data.success) {
    return response;
  }

  return json(
    {
      success: true,
      id: parseInt(attendanceId),
      date,
      startTime,
      endTime,
      breakTime,
    },
    { status: 200 },
  );
}

export async function deleteAttendance(attendanceId: string) {
  const response = await fetchWithPersonioAuth(
    `${PERSONIO_ATTENDANCES_URL}/${attendanceId}`,
    {
      method: "DELETE",
    },
  );

  const data = await response.json();
  if (!data.success) {
    return response;
  }

  return await json(
    { success: true, id: parseInt(attendanceId) },
    { status: 200 },
  );
}
