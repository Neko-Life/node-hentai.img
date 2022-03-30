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
    const folders = await getFolders(page);
    const download = async (url, level) => {
        const parsedUrl = url.split(/\/+/);
        const dir = [];
        const save = parsedUrl.pop().replace("%20", " ");
        for (let i = level + 1; i > 0; i--) {
            dir.push(parsedUrl[parsedUrl.length - i].replace("%20", " "));
        }
        const saveDir = baseDir + dir.join("/");
        let downloaded;
        try {
            downloaded = readdirSync(saveDir);
        } catch (e) {
            downloaded = [];
            mkdirSync(saveDir, { recursive: true });
        }
        if (downloaded.includes(save)) return;
        const get = await axios.get(url, { responseType: "stream" });
        get.data.pipe(createWriteStream(saveDir + "/" + save));
    }
    async function navFile(url, level) {
        const nPage = await browser.newPage();
        await nPage.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.0 Safari/537.36");
        await nPage.setViewport({ width: 1366, height: 768 });
        await nPage.goto(url);
        await nPage.waitForTimeout(5000);
        const mFolders = await getFolders(nPage);
        const fileURIS = await getFiles(nPage);
        for (const folURL of mFolders) {
            if (!folURL) continue;
            if (!folURL.startsWith(url) || folURL === url) continue;
            await navFile(folURL, level + 1);
        }
        for (const fileURL of fileURIS) {
            if (!fileURL) continue;
            await download(fileURL, level);
        }
        await nPage.close();
    }
    for (const fURL of folders) {
        if (!fURL) continue;
        await navFile(fURL, 0);
    }
});

async function getFolders(page) {
    return evalPage(page, "folder");
}

async function getFiles(page) {
    return evalPage(page, "file");
}

/**
 * @param {pup.Page} page
 * @param {"file"|"folder"} type 
 * @returns 
 */
async function evalPage(page, type) {
    return page.evaluate((type) => {
        const gids = document.getElementsByClassName("item " + type);
        const l = [];
        for (const v of gids) {
            const href = v.lastElementChild.href;
            if (!href || l.includes(href)) continue;
            l.push(href);
        }
        return l;
    }, [type]);
}
