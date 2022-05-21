"use strict";

const { exec } = require("child_process");
const { readdirSync, mkdirSync } = require("fs");
const { argv } = require("process");
const pup = require("puppeteer");

const BASE_URL = "https://yande.re";
const baseDir = "yandere";

const br = pup.launch({ headless: !argv.includes("-d") });
let dled = 0;
let outof = 0;
let sk = 0;
const pages = new Map();
const download = async (url) => exec("cd yandere && wget --header 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:100.0) Gecko/20100101 Firefox/100.0' '" + url + "'", async (t, s, e) => {
    // console.log({ t, s, e });
    if (!t && e?.match("100%")?.length) {
        await pages[url].close();
        pages.delete(url);
        dled++;
        console.log(dled + " pics downloaded out of " + outof + ", with " + sk + " skipped");
    } else download(url);
});

br.then(async browser => {
    console.log("Starting up");
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:100.0) Gecko/20100101 Firefox/100.0");
    await page.goto(argv[2]);

    await page.waitForTimeout(3000);

    console.log("Gathering resources");
    const targets = await new Promise(async (re, rj) => {
        const res = [argv[2]];
        const tm = setTimeout(() => re(res), 30000);
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
        outof = targets.length;
    });
    console.log("Downloading " + outof + " pics");
    for (const t of targets) {
        console.log("Downloading '" + t + "'");
        const np = await browser.newPage();
        await np.setUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:100.0) Gecko/20100101 Firefox/100.0");
        await np.goto(t);
        const eva = async () => {
            await np.waitForTimeout(500);
            return np.evaluate(() => {
                let d = document.getElementsByClassName("download-png")[0].href;
                if (!d || d.endsWith("#")) d = document.getElementsByClassName("download-jpeg")[0].href;
                if (!d || d.endsWith("#")) d = document.getElementsByClassName("download-image")[0]?.href;
                if (!d || d.endsWith("#")) d = document.getElementsByClassName("main-image")[0]?.src;
                console.log(d);
                return d;
            });
        };
        let url = await eva();

        while (!url || url.endsWith("#")) {
            console.error("Can't get src for " + t);
            url = await eva();
        }

        let ded = [];

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
            sk++;
            console.log("Skipping " + url + " as it already downloaded");
            continue;
        }

        pages[url] = np;
        download(url);
    }
});
