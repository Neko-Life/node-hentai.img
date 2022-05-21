"use strict";

const { exec } = require("child_process");
const { readdirSync, mkdirSync } = require("fs");
const { argv } = require("process");
const pup = require("puppeteer");

const BASE_URL = "https://yande.re";
const baseDir = "yandere";

const br = pup.launch({ headless: !argv.includes("-d") });
const pages = new Map();
const download = async (url) => exec("cd yandere && wget --header 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:100.0) Gecko/20100101 Firefox/100.0' '" + url + "'", async (t, s, e) => {
    console.log({ t, s, e });
    if (!t) {
        await pages[url].close();
        pages.delete(url);
    } else download(url);
});

br.then(async browser => {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:100.0) Gecko/20100101 Firefox/100.0");
    await page.goto(argv[2]);

    await page.waitForTimeout(3000);

    const targets = await new Promise(async (re, rj) => {
        const res = [argv[2]];
        const tm = setTimeout(() => re(res), 20000);
        for (let i = 0; i < 1000; i++) {
            const ev = await page.evaluate(() => {
                const ts = document.getElementsByClassName("thumb");
                const ret = [];
                for (const a of ts) ret.push(a.href);
                return ret;
            });
            for (const a of ev) if (!res.includes(a)) res.push(a);
            await page.keyboard.press("ArrowRight");
        }
    });
    console.log(targets);
    console.log(targets.length);
    let dled = 0;
    for (const t of targets) {
        console.log("Downloading '" + t + "'");
        const np = await browser.newPage();
        await np.setUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:100.0) Gecko/20100101 Firefox/100.0");
        await np.goto(t);
        const eva = async () => {
            await np.waitForTimeout(200);
            return np.evaluate(() => {
                let d = document.getElementsByClassName("download-png")[0].href;
                if (d.endsWith("#")) d = document.getElementsByClassName("main-image")[0]?.src;
                console.log(d);
                return d;
            });
        };
        let url = await eva();

        console.log(url);

        while (!url || url.endsWith("#")) {
            console.error("Can't get src for " + t);
            url = await eva();
        }

        let ded;

        try {
            ded = readdirSync(baseDir);
        } catch (e) {
            console.log({ e });
            ded = [];
            mkdirSync(baseDir);
        }
        const parsedUrl = url.split(/\/+/);
        const save = decodeURIComponent(parsedUrl.pop());
        if (ded.includes(save)) {
            np.close();
            continue;
        }

        pages[url] = np;
        download(url);
    }
    console.log("Downloaded " + dled + " pics");
});
