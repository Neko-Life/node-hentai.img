"use strict";

const { readdirSync, mkdirSync, createWriteStream } = require("fs");
const pup = require("puppeteer");
const axios = require("axios").default;

const baseURI = "https://xxx.panintegral.tk/";
const baseDir = "./panIntegral/";
try {
    readdirSync(baseDir);
} catch (e) {
    mkdirSync(baseDir);
}

const bot = pup.launch({ headless: !process.argv.includes("-d") });

bot.then(async browser => {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.0 Safari/537.36");
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto(baseURI);
    await page.waitForTimeout(5000);
    const folders = await page.evaluate(() => {
        const gids = document.getElementsByClassName("item folder");
        const l = [];
        for (const v of gids) {
            l.push(v.lastElementChild.href);
        }
        return l;
    });
    const download = async (url) => {
        const parsedUrl = url.split(/\/+/);
        const dir = parsedUrl[parsedUrl.length - 2].replace("%20", " ");
        const save = parsedUrl[parsedUrl.length - 1].replace("%20", " ");
        const saveDir = baseDir + dir;
        let downloaded;
        try {
            downloaded = readdirSync(saveDir);
        } catch (e) {
            downloaded = [];
            mkdirSync(saveDir);
        }
        if (downloaded.includes(save)) return;
        const get = await axios.get(url, { responseType: "stream" });
        get.data.pipe(createWriteStream(saveDir + "/" + save));
    }
    const navFile = async (url) => {
        const nPage = await browser.newPage();
        await nPage.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.0 Safari/537.36");
        await nPage.setViewport({ width: 1366, height: 768 });
        await nPage.goto(url);
        await nPage.waitForTimeout(5000);
        const fileURIS = await nPage.evaluate(() => {
            const gids = document.getElementsByClassName("item file");
            const l = [];
            for (const v of gids) {
                l.push(v.lastElementChild.href);
            }
            return l;
        });
        for (const fileURL of fileURIS) {
            await download(fileURL);
        }
        await nPage.close();
    }
    for (const fURL of folders) {
        await navFile(fURL);
    }
});
