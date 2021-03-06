/*
 * All settings in package,json in root
 *
 * login - "YourLogin@mail.com"
 * password - "YourPassword"
 * startPage - first page on book
 * finishPage - the last one
 * currentPage - the page to start reading from
 * minReadTime - the minimum time for reading a block of text for one click of the scroll
 * maxReadTime - the maximum one
 * maxRepeatTimes - number of unseccesfull tryings
 */
const {
    login,
    password,
    startPage,
    currentPage,
    finishPage,
    minReadTime,
    maxReadTime,
    maxRepeatTimes
} = require('./package.json')

const puppeteer = require('puppeteer')
const chalk = require('chalk')
const fs = require('fs-extra')

;['login', 'reading', 'errors'].forEach((folder) => {
    fs.ensureDirSync(__dirname + '/logs/' + folder)
    const files = fs.readdirSync(__dirname + '/logs/' + folder)
    files.forEach((file) =>
        fs.unlinkSync(__dirname + '/logs/' + folder + '/' + file)
    )
})

const log = {
    system: (str) =>
        console.log(
            `${chalk.cyan('Puppeteer:system')} - ${str} ${chalk.cyan(
                new Date().toLocaleTimeString()
            )}`
        ),
    browser: (str) => console.log(chalk.keyword('orange')(str)),
    error: (str, i) =>
        console.log(
            chalk.redBright(
                'Puppeteer:error - ' +
                    str +
                    ' ' +
                    (i !== undefined ? `(${i})-` : '') +
                    new Date().toLocaleTimeString()
            )
        ),
    login: (str, i) =>
        console.log(
            `${
                chalk.green('Puppeteer:login') +
                (i ? `(${chalk.yellow(i)})` : '')
            } - ${str} ${chalk.green(new Date().toLocaleTimeString())}`
        ),
    reading: (str, i) =>
        console.log(
            `${chalk.blue(
                'Puppeteer:reading' + (i ? `(${chalk.yellow(i)})` : '')
            )} - ${str} ${chalk.blue(new Date().toLocaleTimeString())}`
        )
}

const getLoginLoger = (page) => {
    let counter = 0

    return async (str) => {
        log.login(str, counter)
        await page.screenshot({ path: `./logs/login/login${counter++}.png` })
    }
}

const getReadingLoger = (page) => {
    let counter = 0

    return async (str, folder) => {
        log.reading(str, counter++)
        await page.screenshot({
            path: `./logs/reading/${counter + '-' + (folder || 'reading')}.png`
        })
    }
}

const getErrorsLoger = (page) => {
    let counter = 0

    return async (str) => {
        log.error(str, counter)
        await page.screenshot({ path: `./logs/errors/error${counter++}.png` })
    }
}

const getClickWithWaiting = (page, loger) => async (selector, logs) => {
    await page.waitForSelector(selector)
    await page.click(selector)
    if (loger) await loger(logs)
}

;(async () => {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    log.system('Context initialized')
    page.on('console', (obj) => log.browser(obj.text()))
    let loginLoger = getLoginLoger(page)
    let readingLoger = getReadingLoger(page)
    const errorsLoger = getErrorsLoger(page)
    log.system('Logers initialized')
    const loginClickWithWaiting = getClickWithWaiting(page, loginLoger)
    log.system('Utils initialized')

    let error = false
    let wrongPage = 0

    do {
        if (error) {
            loginLoger = getLoginLoger(page)
            log.system('Logers reinitialized')
        }
        try {
            await loginLoger('Start login')
            await page.goto('https://www.netacad.com/portal/saml_login')
            await page.waitForNavigation()
            await page.waitForSelector('.form-group__text')
            await loginLoger('Intered login page')
            await page.waitForSelector('.input--dirty.input--valid.inputDom')
            await page.type('.input--dirty.input--valid.inputDom', login)
            await loginLoger('Typed login ' + chalk.red(login))
            if (!error) {
                await page.click('input[value="Next"]')
            } else {
                await page.click('#btn')
            }
            await page.waitForSelector('#password')
            await page.type('#password', password)
            await loginLoger('Typed password ' + chalk.red(password))
            await page.click('#kc-login')
            await loginClickWithWaiting('.course-launcher', 'Launched course')
            await loginClickWithWaiting('#launchlink', 'Open course')
            log.login('Start waiting for loader')
            await page.waitForTimeout(10 * 1000)
            log.login('Stop waiting for loader')
            try {
                await loginClickWithWaiting('#bg-0', 'Choosed background')
            } catch (e) {
                log.error(e.message)
                await errorsLoger('Skip background choose')
            }

            let [a, b, c, d] = (currentPage || startPage).split('.')
            if (wrongPage > maxRepeatTimes) {
                wrongPage = 0
                ;[a, b, c, d] = startPage.split('.')
                log.error('Cant pick ' + chalk.blue(currentPage))
                log.error('Setting ' + chalk.blue(startPage) + ' instead')
            }

            await loginClickWithWaiting(
                `a[href="#${a}"]`,
                `Clicked ${chalk.red(a)} course`
            )
            await loginClickWithWaiting(
                `a[href="#${a}.${b}"]`,
                `Clicked ${chalk.red(a)}.${chalk.red(b)} subcourse`
            )
            await loginClickWithWaiting(
                `a[href="#${a}.${b}.${c}"]`,
                `Clicked ${chalk.red(a)}.${chalk.red(b)}.${chalk.red(
                    c
                )} subcourse`
            )
            await loginClickWithWaiting(
                `a[href="#${a}.${b}.${c}.${d}"]`,
                `Clicked ${chalk.red(a)}.${chalk.red(b)}.${chalk.red(
                    c
                )}.${chalk.red(d)} subcourse`
            )
            error = false

            let location = null
            while (location != finishPage) {
                try {
                    const url = page.url()
                    const hash = url.match(/#.*/)
                    location = hash.toString().match(/\d+/g).join('.')
                } catch (e) {
                    log.error(e.message)
                    location = location + '@next'
                    await errorsLoger('Skip location direct definition')
                }
                await page.waitForSelector('#page-menu-next-button')

                log.reading('Reading location: ' + chalk.red(location))
                console.log(chalk.keyword('orange')('---'))
                try {
                    await page.waitForSelector('#frame')
                    const elementHandle = await page.$('#frame')
                    const frame = await elementHandle.contentFrame()

                    await frame.waitForSelector('#text', {
                        timeout: 10000
                    })

                    await frame.click('#text')

                    await frame.$eval(
                        '#text',
                        (element, minReadTime, maxReadTime) =>
                            new Promise((resolve) => {
                                let height = 0

                                let timeout = setTimeout(function scroll() {
                                    console.log(
                                        'scrolled ',
                                        height,
                                        '/',
                                        element.scrollHeight
                                    )

                                    element.scrollBy(
                                        height,
                                        (height = height + 100)
                                    )
                                    if (height < element.scrollHeight)
                                        setTimeout(
                                            scroll,
                                            Math.floor(
                                                Math.random() *
                                                    (maxReadTime -
                                                        minReadTime) +
                                                    minReadTime
                                            )
                                        )
                                    else resolve()
                                }, 1000)
                            }),
                        minReadTime,
                        maxReadTime
                    )
                    await readingLoger(
                        'Succesfull readed ' + chalk.red(location),
                        location
                    )
                } catch (e) {
                    log.error(e.message)
                    if (e.message.includes('#text')) {
                        const onLine = await page.evaluate(
                            () => window.navigator.onLine
                        )
                        if (!onLine) {
                            await errorsLoger(
                                'Internet connection lost, relogin...'
                            )
                            throw Error(e)
                        }
                        await errorsLoger('Skip the ' + chalk.red(location))
                    } else {
                        throw Error(e)
                    }
                }

                try {
                    const config = fs.readJSONSync(__dirname + '/package.json')
                    config.currentPage = location
                    fs.writeJSONSync(__dirname + '/package.json', config)
                    log.system('Сonfig rewrited')
                } catch (e) {
                    log.error(e.message)
                    log.error('Skip setting currentpage in config')
                }

                await page.click('#page-menu-next-button')
            }
        } catch (e) {
            error = true
            log.error(e.message)
            if (e.message.includes('a[href="')) {
                log.error(
                    'Cant pick ' +
                        chalk.blue(currentPage) +
                        ' ' +
                        ++wrongPage +
                        ' times'
                )
                log.error('Check the correctness of the selected page ')
            }
            await errorsLoger('Making session failed. Trying again...')
            const client = await page.target().createCDPSession()
            await client.send('Network.clearBrowserCookies')
            await client.send('Network.clearBrowserCache')
            log.system('Cookies cleared')
        }
    } while (error)

    await browser.close()
    log.system('Browser closed')
})()
