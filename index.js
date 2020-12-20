const puppeteer = require('puppeteer');
const chalk = require('chalk');
const fs = require('fs-extra');

const { login, password, courseNumber } = require('./package.json');

fs.ensureDirSync(__dirname+'/logs/login');
fs.ensureDirSync(__dirname+'/logs/reading');

const log = {
  system: str => console.log(`${chalk.cyan('Puppeteer:system')} - ${str} ${chalk.cyan(new Date().toLocaleTimeString())}`),
  browser: str => console.log(chalk.keyword('orange')(str)),
  error: (str,i) => console.log(chalk.red('Puppeteer:error - '+str+' '+i+':'+new Date().toLocaleTimeString())),
  login: (str,i) => console.log(`${chalk.green('Puppeteer:login')+(i ? `(${chalk.yellow(i)})`: '')} - ${str} ${chalk.green(new Date().toLocaleTimeString())}`),
  reading: (str,i) => console.log(`${chalk.blue('Puppeteer:reading' + (i ? `(${chalk.yellow(i)})` : ''))} - ${str} ${chalk.blue(new Date().toLocaleTimeString())}`),
}

const getLoginLogger = (page) => {
  let counter = 0;

  return async(str) => {
    log.login(str, counter)
    await page.screenshot({path: `./logs/login/login${counter++}.png`});
  }
}

const getReadingLogger = (page) => {
  let counter = 0;

  return async(str, folder) => {
    log.reading(str, counter++)
    await page.screenshot({path: `./logs/reading/reading${(folder || '') + counter}.png`});
  }
}

const getErrorsLogger = (page) => {
  let counter = 0;

  return async(str) => {
    log.error(str, counter)
    await page.screenshot({path: `./logs/errors/error${counter++}.png`});
  }
}

const getClickWithWaiting = (page, loger) => async(selector, logs) => {
  await page.waitForSelector(selector);
  await page.click(selector);
  if (loger) loger(logs);
}

(async () => {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    log.system('Context initialized')
    page.on('console', obj => log.browser(obj.text()))
    let loginLogger = getLoginLogger(page)
    let readingLogger = getReadingLogger(page)
    const errorsLogger = getErrorsLogger(page)
    log.system('Loggers initialized')
    const loginClickWithWaiting = getClickWithWaiting(page, loginLogger)
    log.system('Utils initialized')

    let error = false;
    do {
      if (error){      
        loginLogger = getLoginLogger(page)
        log.system('Loggers reinitialized')
      }
      try {
        await loginLogger('Start login');
        await page.goto('https://www.netacad.com/portal/saml_login')
        await page.waitForNavigation()
        await page.waitForSelector('.form-group__text')
        await loginLogger('Intered login page')
        await page.waitForSelector('.input--dirty.input--valid.inputDom')
        await page.type('.input--dirty.input--valid.inputDom', login)
        await loginLogger('Typed login '+chalk.red(login))
        if (!error) {
          await page.click('input[value="Next"]');
        } else {
          await page.click('#btn');
        }
        await page.waitForSelector('#password');
        await page.type('#password', password);
        await loginLogger('Typed password '+chalk.red(password))
        await page.click('#kc-login')
        await loginClickWithWaiting('.course-launcher', 'Launched course')
        await loginClickWithWaiting('#launchlink', 'Open course')
        log.login('Start waiting for loader');
        await page.waitForTimeout(10*1000);
        log.login('Stop waiting for loader');
        await loginClickWithWaiting('#bg-0', 'Choosed background')
        
        const [a,b,c,d] = courseNumber.split('.');
        
        await loginClickWithWaiting(`a[href="#${a}"]`, `Clicked ${chalk.red(a)} course`)
        await loginClickWithWaiting(`a[href="#${a}.${b}"]`, `Clicked ${chalk.red(a)}.${chalk.red(b)} subcourse`)
        await loginClickWithWaiting(`a[href="#${a}.${b}.${c}"]`, `Clicked ${chalk.red(a)}.${chalk.red(b)}.${chalk.red(c)} subcourse`)
        await loginClickWithWaiting(`a[href="#${a}.${b}.${c}.${d}"]`, `Clicked ${chalk.red(a)}.${chalk.red(b)}.${chalk.red(c)}.${chalk.red(d)} subcourse`)
        error=false;
      } catch(e) {
        error = true;
        log.error(e)
        errorsLogger('Login failed. Trying again...');
        const client = await page.target().createCDPSession();
        await client.send('Network.clearBrowserCookies');
        await client.send('Network.clearBrowserCache');
        log.system('Cookies cleared');
      }
    } while(error);
    
    let location = null;
    while(location != '11.3.1.3') {
      await readingLogger('Reading location: '+chalk.red((location = page.url().match(/#.*/)?.toString()?.match(/\d+/g)?.join('.'))));
      await page.waitForSelector('#page-menu-next-button');
      console.log(chalk.keyword('orange')('---'))

      
      try {
        await page.waitForSelector('#frame');
        const elementHandle = await page.$('#frame');
        const frame = await elementHandle.contentFrame();
        
        await frame.waitForSelector('#text', {
          timeout: 10000
        });
        
        await frame.$eval('#text', element => new Promise(resolve => {
          let height = 0;
          
          let timeout = setTimeout(function scroll() {
            console.log('scrolled ', height, '/', element.scrollHeight)

            element.scrollBy(height, height = height + 100);
            if (height < element.scrollHeight)
              setTimeout(scroll, Math.floor(Math.random()*(5000 - 2000) + 2000))
            else resolve()
          }, 1000)
        }))
        readingLogger('Succesfull readed '+chalk.red(location), location)

      } catch(e) {
        log.error(e)
        errorsLogger(' Skip the '+ chalk.red(location));
      }
      await page.click('#page-menu-next-button');
    }
   
    await browser.close();
    log.system('Browser closed')
  })();

  //#text