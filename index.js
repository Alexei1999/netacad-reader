const {
  login,
  password,
  startPage,
  currentPage,
  finishPage,
  minReadTime,
  maxReadTime,
  maxWrongPageSelects,
  maxErrorNumber,
  bookSelector,
  headlessMode,
} = require("./config.json");

const puppeteer = require("puppeteer");
const chalk = require("chalk");
const fs = require("fs-extra");

["login", "reading", "errors"].forEach((folder) => {
  fs.ensureDirSync(__dirname + "/logs/" + folder);
  const files = fs.readdirSync(__dirname + "/logs/" + folder);
  files.forEach((file) =>
    fs.unlinkSync(__dirname + "/logs/" + folder + "/" + file)
  );
});

const log = {
  system: (str) =>
    console.log(
      `${chalk.cyan("Puppeteer:system")} - ${str} ${chalk.cyan(
        new Date().toLocaleTimeString()
      )}`
    ),
  browser: (str) => console.log(chalk.keyword("orange")(str)),
  error: (str, i) =>
    console.log(
      chalk.redBright(
        "Puppeteer:error - " +
          str +
          " " +
          (i !== undefined ? `(${i})-` : "") +
          new Date().toLocaleTimeString()
      )
    ),
  login: (str, i) =>
    console.log(
      `${
        chalk.green("Puppeteer:login") + (i ? `(${chalk.yellow(i)})` : "")
      } - ${str} ${chalk.green(new Date().toLocaleTimeString())}`
    ),
  reading: (str, i) =>
    console.log(
      `${chalk.blue(
        "Puppeteer:reading" + (i ? `(${chalk.yellow(i)})` : "")
      )} - ${str} ${chalk.blue(new Date().toLocaleTimeString())}`
    ),
};

const getLoginLoger = (page) => {
  let counter = 0;

  return async (str) => {
    log.login(str, counter);
    await page.screenshot({ path: `./logs/login/login${counter++}.png` });
  };
};

const getReadingLoger = (page) => {
  let counter = 0;

  return async (str, folder) => {
    log.reading(str, counter++);
    await page.screenshot({
      path: `./logs/reading/${counter + "-" + (folder || "reading")}.png`,
    });
  };
};

const getErrorsLoger = (page) => {
  let counter = 0;

  return async (str) => {
    log.error(str, counter);
    await page.screenshot({ path: `./logs/errors/error${counter++}.png` });
  };
};

const getClickWithWaiting = (page, loger) => async (selector, logs) => {
  await page.waitForSelector(selector);
  await page.click(selector);
  if (loger) await loger(logs);
};

const initLogers = (page) => {
  page.on("console", (obj) => log.browser(obj.text()));
  return {
    loginLoger: getLoginLoger(page),
    readingLoger: getReadingLoger(page),
    errorsLoger: getErrorsLoger(page),
  };
};

(async () => {
  const browser = await puppeteer.launch({ headless: headlessMode });

  const pages = await browser.pages();
  pages.forEach((page) => page.close());

  let page = await browser.newPage();
  log.system("Context initialized");

  let { loginLoger, readingLoger, errorsLoger } = initLogers(page);
  log.system("Logers initialized");

  let loginClickWithWaiting = getClickWithWaiting(page, loginLoger);
  log.system("Utils initialized");

  let error = false;
  let wrongPage = 0;
  let errors = 0;

  do {
    if (error) {
      ({ loginLoger, readingLoger, errorsLoger } = initLogers(page));
      loginClickWithWaiting = getClickWithWaiting(page, loginLoger);
      log.system("Logers reinitialized");
    }
    try {
      await loginLoger("Login started");
      await page.goto("https://www.netacad.com/portal/saml_login");
      //   await page.waitForNavigation();
      await page.waitForSelector('[data-se="o-form-fieldset"]');
      await loginLoger("Intered to a login page");
      await page.waitForSelector('[name="username"]');
      await page.type('[name="username"]', login);
      await loginLoger("Typed username " + chalk.red(login));

      await page.click("#idp-discovery-submit");

      log.login("Start waiting for loader");
      await page.waitForTimeout(5 * 1000);
      log.login("Stop waiting for loader");

      await page.waitForSelector('[name="password"]');
      await page.type('[name="password"]', password);
      await loginLoger("Typed password " + chalk.red(password));

      await page.waitForSelector("#okta-signin-submit");
      await page.click("#okta-signin-submit");
      await page.waitForNavigation();

      await loginClickWithWaiting(".course-launcher", "Launching course");
      await page.waitForNavigation();
      await loginClickWithWaiting(
        bookSelector,
        "Custom selector " + chalk.red(bookSelector) + " clicked"
      );

      const pages = await browser.pages();
      if (pages.length > 1) {
        log.system("hew tab handled, page context reinitialization");

        page = pages.pop();
        log.system("page ref reinitilized");

        pages.forEach((page) => page.close());
        log.system("other tabs closed");

        ({ loginLoger, readingLoger, errorsLoger } = initLogers(page));
        loginClickWithWaiting = getClickWithWaiting(page, loginLoger);
        log.system("loggers reinitilized");

        try {
          page.waitForNavigation();
        } catch (e) {
          log.error(e);
        }
      }

      log.login("Start waiting for loader");
      await page.waitForTimeout(10 * 1000);
      log.login("Stop waiting for loader");
      try {
        await loginClickWithWaiting("#bg-0", "Choosed background");
      } catch (e) {
        log.error(e.message);
        await errorsLoger("Skip background choose");
      }

      let [a, b, c, d] = (currentPage || startPage).split(".");
      if (wrongPage > maxWrongPageSelects) {
        wrongPage = 0;
        [a, b, c, d] = startPage.split(".");
        log.error("Cant pick " + chalk.blue(currentPage));
        log.error("Setting " + chalk.blue(startPage) + " instead");
      }

      await loginClickWithWaiting(
        `a[href="#${a}"]`,
        `Clicked ${chalk.red(a)} course`
      );
      await loginClickWithWaiting(
        `a[href="#${a}.${b}"]`,
        `Clicked ${chalk.red(a)}.${chalk.red(b)} subcourse`
      );
      await loginClickWithWaiting(
        `a[href="#${a}.${b}.${c}"]`,
        `Clicked ${chalk.red(a)}.${chalk.red(b)}.${chalk.red(c)} subcourse`
      );
      await loginClickWithWaiting(
        `a[href="#${a}.${b}.${c}.${d}"]`,
        `Clicked ${chalk.red(a)}.${chalk.red(b)}.${chalk.red(c)}.${chalk.red(
          d
        )} subcourse`
      );
      error = false;

      let location = null;
      while (location != finishPage) {
        try {
          const url = page.url();
          const hash = url.match(/#.*/);
          location = hash.toString().match(/\d+/g).join(".");
        } catch (e) {
          log.error(e.message);
          location = location + "@next";
          await errorsLoger("Skip location direct definition");
        }
        await page.waitForSelector("#page-menu-next-button");

        log.reading("Reading location: " + chalk.red(location));
        console.log(chalk.keyword("orange")("---"));
        try {
          await page.waitForSelector("#frame");
          const elementHandle = await page.$("#frame");
          const frame = await elementHandle.contentFrame();

          await frame.waitForSelector("#text", {
            timeout: 10000,
          });

          await frame.click("#text");

          try {
            await frame.$eval(
              "#text",
              (element) =>
                new Promise((resolve) => {
                  setTimeout(() => {
                    console.log("onload event skipped due to timeout");
                    resolve();
                  }, 3000);
                  element.onload = resolve;
                })
            );
          } catch {}

          await frame.$eval(
            "#text",
            (element, minReadTime, maxReadTime) =>
              new Promise((resolve) => {
                let height = element.clientHeight;

                setTimeout(function scroll() {
                  console.log("scrolled ", height, "/", element.scrollHeight);

                  if (height < element.scrollHeight) {
                    element.scrollBy(0, 100);
                    height = height + 100;

                    const waitTime = Math.floor(
                      Math.random() * (maxReadTime - minReadTime) + minReadTime
                    );

                    setTimeout(scroll, waitTime);
                  } else {
                    resolve();
                  }
                }, 1000);
              }),
            minReadTime,
            maxReadTime
          );
          await readingLoger(
            "Succesfull readed " + chalk.red(location),
            location
          );
        } catch (e) {
          log.error(e.message);
          if (
            e.message.includes("#text") ||
            e.message.includes("not an HTMLElement")
          ) {
            const onLine = await page.evaluate(() => window.navigator.onLine);
            if (!onLine) {
              await errorsLoger("Internet connection lost, relogin...");
              throw Error(e);
            }
            await errorsLoger("Skip the " + chalk.red(location));
          } else {
            throw Error(e);
          }
        }

        try {
          const config = fs.readJSONSync(__dirname + "/config.json");
          config.currentPage = location;
          fs.writeJSONSync(__dirname + "/config.json", config, {});
          log.system("config.json rewrited");
        } catch (e) {
          log.error(e.message);
          log.error("Skip setting currentpage in config");
        }

        await page.click("#page-menu-next-button");
      }
    } catch (e) {
      error = true;
      log.error(e.message);
      if (e.message.includes('a[href="')) {
        log.error(
          "Cant pick " + chalk.blue(currentPage) + " " + ++wrongPage + " times"
        );
        log.error("Check the correctness of the selected page ");
      } else {
        errors++;
        if (errors > maxErrorNumber) {
          log.error(
            `Max number of the fail attempts has been reached (${maxErrorNumber}). Shut down the reader...`
          );
          break;
        }
      }
      await errorsLoger("Session failed. Trying again...");
      const client = await page.target().createCDPSession();
      await client.send("Network.clearBrowserCookies");
      await client.send("Network.clearBrowserCache");
      log.system("Cookies cleared");
    }
  } while (error);

  await browser.close();
  log.system("Browser closed");
})();
