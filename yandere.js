"use strict";

const { exec } = require("child_process");
const { readdirSync, mkdirSync } = require("fs");
const { argv } = require("process");
const pup = require("puppeteer");

const BASE_URL = "https://yande.re";
const baseDir = "yandere";

const br = pup.launch({ headless: !argv.includes("-d") });
let o = 0;

const download = (url) => exec("cd yandere && wget --header 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:100.0) Gecko/20100101 Firefox/100.0' '" + url + "'", (t, s, e) => {
    console.log({ t, s, e });
    if (!t) o++;
    else download(url);
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
    const urdone = [];
    for (const t of targets) {
        const oo = o;
        console.log("Downloading '" + t + "'");
        await page.goto(t);
        await page.waitForTimeout(10000);
        const url = await page.evaluate(() => {
            return document.getElementsByClassName("download-png")[0].href;
        });
        if (urdone.includes(url)) continue;

        let ded;

        try {
            ded = readdirSync(baseDir);
        } catch (e) {
            ded = [];
            mkdirSync(baseDir);
        }
        const parsedUrl = url.split(/\/+/);
        const save = parsedUrl.pop().replace("%20", " ");
        if (ded.includes(save)) {
            urdone.push(url);
            continue;
        }

        download(url);
        while (oo == o) await new Promise((r, j) => setTimeout(r, 1000));
        urdone.push(url);
        dled++;
    }
    console.log("Downloaded " + dled + " pics");
});
