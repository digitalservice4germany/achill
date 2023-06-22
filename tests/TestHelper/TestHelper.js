export async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function initializeTestSetup(context, apiStub) {
  // const apiStub = new TroiApiStub();

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
      const matchedResponse = await apiStub.match(
        method,
        pathname,
        params,
        postData
      );

      if (matchedResponse !== null) {
        // console.log(
        //   "Fulfilling route %s with response: %s",
        //   pathname,
        //   matchedResponse
        // );
        route.fulfill(matchedResponse);
      } else {
        console.log({ matchedResponse, method, pathname, params, postData });
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
      // Simulate trois api delay
      await sleep(500);
      route.fulfill(apiStub._response({}));
    } else {
      route.continue();
    }
  });
}
