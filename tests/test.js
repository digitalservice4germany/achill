import { expect, test } from "@playwright/test";
import md5 from "crypto-js/md5.js";

class LoginPage {
  constructor(page) {
    this.page = page;
  }

  async logIn(username, password) {
    await this.page.goto("/");
    await this.page.locator("#username").fill(username);
    await this.page.locator("#password").fill(password);
    await this.page.locator("text=Sign in").click();
  }
}

class TimeEntriesPage {
  constructor(page) {
    this.page = page;
  }

  async addEntry(year, month, date, hours, description) {
    await this.page.locator('[placeholder="2022-01-01"]').click();
    await this.page.locator("select").first().selectOption({ label: month });
    await this.page.locator("select").nth(2).selectOption(year);
    await this.page.locator(`span >> text="${date}"`).click();
    await this.page.locator('[placeholder="2:15"]').fill(hours);
    await this.page
      .locator('[placeholder="Working the work…"]')
      .fill(description);
    await this.page.locator("text=Add").click();
  }
}

const correctUser = "user.name";
const correctPassword = "s3cr3t";

const mockData = {
  client: {
    Name: "DigitalService4Germany GmbH",
    Id: 123,
  },
  employee: {
    Id: 456,
  },
  calculationPosition: {
    DisplayPath: "My Project",
    Id: 789,
  },
};

class TroiApiStub {
  constructor() {
    this.entries = [];

    this.correctAuthnHeader = `Basic ${btoa(
      `${correctUser}:${md5(correctPassword)}`
    )}`;
  }

  addEntry(entry) {
    this.entries.push(entry);
  }

  deleteEntry(id) {
    this.entries = this.entries.filter((entry) => entry.id !== id);
  }

  isAuthorized(authnHeader) {
    return authnHeader === this.correctAuthnHeader;
  }

  unauthorizedResponse() {
    return this._response({ status: 401 });
  }

  match(method, pathname, params, postData) {
    if (method === "GET" && pathname.endsWith("/clients")) {
      return this._response({ jsonBody: [mockData.client] });
    } else if (
      method === "GET" &&
      pathname.endsWith("/employees") &&
      params.get("clientId") === mockData.client.Id.toString() &&
      params.get("employeeLoginName") === correctUser
    ) {
      return this._response({ jsonBody: [mockData.employee] });
    } else if (
      method === "GET" &&
      pathname.endsWith("/calculationPositions") &&
      params.get("clientId") === mockData.client.Id.toString() &&
      params.get("favoritesOnly") === "true"
    ) {
      return this._response({ jsonBody: [mockData.calculationPosition] });
    } else if (
      method === "GET" &&
      pathname.endsWith("/billings/hours") &&
      params.get("clientId") === mockData.client.Id.toString() &&
      params.get("employeeId") === mockData.employee.Id.toString() &&
      params.get("calculationPositionId") ===
        mockData.calculationPosition.Id.toString()
    ) {
      return this._response({ jsonBody: this.entries });
    } else if (method === "POST" && pathname.endsWith("/billings/hours")) {
      this.addEntry({
        id: 1,
        Date: postData.Date,
        Quantity: postData.Quantity,
        Remark: postData.Remark,
      });
      return this._response({});
    } else {
      return null;
    }
  }

  _response({ status = 200, jsonBody = {} }) {
    return {
      status: status,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(jsonBody),
    };
  }
}

let apiStub;

test.beforeEach(async ({ context }) => {
  apiStub = new TroiApiStub();

  await context.route(
    "https://digitalservice.troi.software/api/v2/rest/**",
    async (route) => {
      const authnHeader = await route.request().headerValue("Authorization");
      if (!apiStub.isAuthorized(authnHeader)) {
        route.fulfill(apiStub.unauthorizedResponse());
        return;
      }

      const method = route.request().method();
      const { pathname, searchParams: params } = new URL(route.request().url());
      const postData = route.request().postDataJSON();
      const matchedResponse = apiStub.match(method, pathname, params, postData);

      if (matchedResponse !== null) {
        route.fulfill(matchedResponse);
      } else {
        route.abort();
      }
    }
  );

  await context.route("/time_entries/*", async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();

    const id = parseInt(pathname.split("/").at(-1));

    if (method === "DELETE") {
      apiStub.deleteEntry(id);
      route.fulfill(apiStub._response({}));
    } else {
      route.continue();
    }
  });
});

test.describe("Auth", async () => {
  test("failed log in", async ({ page }) => {
    await new LoginPage(page).logIn(correctUser, "wrong password");

    await expect(page.locator("text=Login failed")).toBeVisible();
  });

  test("log in and back out", async ({ page }) => {
    await new LoginPage(page).logIn(correctUser, correctPassword);
    await expect(
      page.locator("nav div >> text=Logged in as user.name")
    ).toBeVisible();

    await page.locator("text=Log out").click();
    await expect(page.locator("h2 >> text=Enter. Time.")).toBeVisible();
  });
});

test.describe("Time entries", async () => {
  test("add entry", async ({ page }) => {
    await new LoginPage(page).logIn(correctUser, correctPassword);

    await new TimeEntriesPage(page).addEntry(
      "2022",
      "January",
      "17",
      "4:45",
      "a task"
    );

    await expect(page.locator("tr")).toHaveCount(3);

    const firstRow = page.locator("tr >> nth=1");
    await expect(firstRow.locator("td >> nth=0")).toHaveText("Mon 2022-01-17");
    await expect(firstRow.locator("td >> nth=1")).toHaveText("4:45");
    await expect(firstRow.locator("td >> nth=2")).toHaveText("a task");

    const newEntryRow = page.locator("tr >> nth=-1");
    await expect(newEntryRow.locator("td >> nth=0")).toBeEmpty();
    await expect(newEntryRow.locator("td >> nth=1")).toBeEmpty();
    await expect(newEntryRow.locator("td >> nth=2")).toBeEmpty();
  });

  test("add entry with secondary hour fraction format", async ({ page }) => {
    await new LoginPage(page).logIn(correctUser, correctPassword);

    await new TimeEntriesPage(page).addEntry(
      "2022",
      "January",
      "17",
      "2.333333333333333",
      "a task"
    );

    const firstRow = page.locator("tr >> nth=1");
    await expect(firstRow.locator("td >> nth=1")).toHaveText("2:20");
  });

  test("add entry - invalid data", async ({ page }) => {
    await new LoginPage(page).logIn(correctUser, correctPassword);

    await new TimeEntriesPage(page).addEntry(
      "2022",
      "January",
      "17",
      "4:5t",
      ""
    );

    await expect(page.locator("tr")).toHaveCount(2);

    const newEntryRow = page.locator("tr >> nth=-1");
    await expect(newEntryRow.locator("td >> nth=1 >> input")).toHaveCSS(
      "border-color",
      "rgb(239, 68, 68)"
    );
    await expect(newEntryRow.locator("td >> nth=2 >> input")).toHaveCSS(
      "border-color",
      "rgb(239, 68, 68)"
    );
  });

  test("delete entry", async ({ page }) => {
    await new LoginPage(page).logIn(correctUser, correctPassword);

    apiStub.addEntry({
      id: 1,
      Date: "2022-01-22",
      Quantity: 1.25,
      Remark: "delete me",
    });

    await page.click('text="Delete"');

    await expect(page.locator("tr")).toHaveCount(2);
    await expect(page.locator("table")).not.toContainText("delete me");
  });

  test("generate entry", async ({ page }) => {
    await new LoginPage(page).logIn(correctUser, correctPassword);

    const inputField = page.locator("tr >> nth=-1");
    await expect(
      inputField.locator('[placeholder="Working the work…"]')
    ).toBeEmpty();
    await page.screenshot({ path: "screenshot0.png" });
    await page.click('text="I\'m lazy"');
    await page.screenshot({ path: "screenshot1.png" });

    await expect(
      inputField.locator('[placeholder="Working the work…"]')
    ).not.toBeEmpty();
  });
});
