'use strict';

const puppeteer = require("puppeteer");
const fs = require("fs");
const { join } = require("path");
const { terminal } = require("terminal-kit");

const bot = puppeteer.launch({ headless: false });
/**
 * @type {import("nextgen-events")}
 */
let terminalInstance;

bot.then((browser) => {
    terminal.brightGreen("Ready");
    function run() {
        terminal.brightGreen(" > ")
        terminalInstance = terminal.inputField({ cancelable: true, style: terminal.brightYellow }, async (e, buff) => {
            console.log();
            if (e) {
                console.error(e);
                return setTimeout(run, 5000);
            } else if (buff === undefined)
                process.exit();
            let args = buff.split(" ");
            let getArg = false;
            if (args[0] === "exit")
                process.exit();
            else if (args[0].startsWith("https://hentai-img.com/image")) {
                getArg = true;
                run();
                args = await getFromLink(browser, args);
            } else if (args[0] === "d") {
                process.dev = !process.dev;
                console.log("Debug " + (process.dev ? "enabled" : "disabled"));
                return getArg ? null : run();
            } else if (!args[1] || !/^https:\/\//.test(args[1])) {
                if (process.dev) console.log(args);
                console.error("Invalid arguments. Should be `<dirname> <base URL> [startNum] [endNum]` or `<url> [startNum] [endNum]`");
                return getArg ? null : run();
            };
            getArg ? null : run();
            const data = {
                SAVE_DIR: "./Saves/" + args[0],
                baseURL: args[1].endsWith("/") ? args[1] : (args[1] + "/"),
                i: args[2] ? parseInt(args[2]) : 1,
                to: args[3] ? parseInt(args[3]) : 9999999,
                ext: "jpg"
            };
            scrpe(browser, data);
        });
    }
    run();
});

process.on("uncaughtException", (e, o) => {
    console.error(e, o);
});

async function scrpe(browser, {
    SAVE_DIR = "./Saves/",
    baseURL,
    i = 1,
    to = 9999999,
    ext = "jpg"
} = {}) {
    logDev({
        SAVE_DIR,
        baseURL,
        i,
        to,
        ext
    });
    if (typeof baseURL !== "string") throw new TypeError("baseURL isn't string, got " + typeof baseURL);
    let retried = 0;
    let skipped = 0;
    let start = 0;
    let saved = 0;
    const save = async (buff, output) => {
        try { fs.readdirSync(join(__dirname, SAVE_DIR)); }
        catch { fs.mkdirSync(join(__dirname, SAVE_DIR), { recursive: true }); }
        const pat = join(__dirname, SAVE_DIR + "/" + output);
        fs.writeFile(pat, buff, null, e => e ? console.error(e) : logDev("Saved", pat));
        saved++;
    }
    /**
     * @type {puppeteer.Page}
     */
    const page = await browser.newPage();
    await page.setViewport({ width: 720, height: 480 });
    page.on("response", async (res) => {
        if (res.request().resourceType() === "document") {
            if (!res.ok()) {
                if (++retried < 4) {
                    logDev(`RETRYING ${i--}.${ext}\nBASE URL:`, baseURL);
                } else {
                    logDev(`TRIED ${retried} TIMES AND KEEP FAILING. SKIPPING...`);
                    skipped++;
                    retried = 0;
                }
                if (ext === "jpg") ext = "png";
                else if (ext === "png") ext = "jpg";
                return;
            }
            retried = 0;
            const name = res.url().split("/").pop().split(".");
            const num = name.shift();
            const ext2 = name.pop();
            // const nameImg = Math.floor(Math.random() * 99999999999999999999);
            const buff = await res.buffer();
            const saveN = num /* +  nameImg */ + "." + ext2;
            logDev("Saving " + saveN);
            await save(buff, saveN);
        }
    });
    start = i;
    for (i; i <= to; i++) {
        if (skipped > 5) {
            logDev(--skipped + " FAILED ATTEMPTS. CLOSING");
            break;
        }
        try {
            await page.goto(baseURL + i + "." + ext);
        } catch (e) {
            console.error(e);
            if (/Target closed\./.test(e.message))
                break;
            i--;
            continue;
        }
        await page.waitForTimeout(1000);
    }
    logTerm("log", `------------------------------------------------------------------------------------------\n${page.url()}: STOPPED AT ${--i}\nSAVED ${saved} FILES FROM ${start} TO ${to}\nin "${SAVE_DIR}"\nwith URL "${baseURL}"\nCLOSING PAGE...\n------------------------------------------------------------------------------------------`);
    page.close();
}

/**
 * 
 * @param {puppeteer.Browser} browser 
 * @param {string[]} args 
 */
async function getFromLink(browser, args) {
    const page = await browser.newPage();
    await page.setViewport({ width: 720, height: 420 });

    const newArgs = [];

    const parsedUrl = args[0].replace(/\//g, " ").trim().split(" ");
    newArgs[0] = parsedUrl[parsedUrl.length - 1];
    async function go() {
        try {
            await page.goto(args[0].replace("/image/", "/story/"));
        } catch (e) {
            if (e.message === "Navigation timeout of 30000 ms exceeded")
                return go();
            else logTerm("error", e);
        }
    };
    await go();
    await page.waitForSelector("#cover > amp-story-grid-layer > amp-img > img");
    await page.waitForTimeout(200);
    const get = await page.evaluate(() => {
        const a = document.querySelector("#cover > amp-story-grid-layer > amp-img > img");
        return a.src;
    });
    newArgs[1] = get.slice(0, -5);
    newArgs.push(...args.slice(1));
    page.close();
    return newArgs;
}

function logDev(...args) {
    if (!process.dev) return;
    logTerm("debug", ...args);
}

/**
 * 
 * @param {"debug"|"log"|"error"|"warn"} std 
 * @param  {...any} args 
 */
function logTerm(std, ...args) {
    if (terminalInstance)
        terminalInstance.hide();
    console[std](...args);
    if (terminalInstance) {
        terminalInstance.redraw();
        terminalInstance.show();
    }
}

terminal.on("resize", () => {
    if (!terminalInstance) return;
    terminalInstance.hide();
    terminalInstance.rebase();
    terminalInstance.show();
});

function maxChar(str) {
    const count = {};
    for (const s of str) {
        if (!count[s]) count[s] = 0;
        count[s]++;
    }
    let max = 0;
    let key;
    for (const k in count) {
        const num = count[k];
        if (num <= max) continue;
        max = num;
        key = k;
    }
    return { key: key, count: max }
}
