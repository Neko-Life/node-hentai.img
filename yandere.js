"use strict";

const { exec } = require("child_process");
const { readdirSync, mkdirSync, unlinkSync } = require("fs");
const { join } = require("path");
const { argv } = require("process");
const pup = require("puppeteer");

const BASE_URL = "https://yande.re";
const baseDir = "yandere";

if (!/^https:\/\/yande\.re\/post\/browse#\d{6}\//.test(argv[2] || "")) {
    console.error("Usage: <URL> [(-d|--head|--no-headless)] <[resource gathering time in second] [number of concurrent download]>\nExample: \"node yandere.js 'https://yande.re/post/browse#833126/wardrobe_malfunction' -d 4 60\"");
    process.exit(["--help", "-h"].some(r => argv.includes(r)) ? 0 : 1);
}

let wait_t = 30;
let concurrent = 1;

if (!argv[argv.length - 2].match(/\D/)?.length) wait_t = parseInt(argv[argv.length - 2], 10);
if (!argv[argv.length - 1].match(/\D/)?.length) concurrent = parseInt(argv[argv.length - 1], 10);
console.log("Resource gathering time: " + wait_t + " seconds");
console.log("Number of concurrent download: " + concurrent);
if (concurrent > 5) console.warn("[WARNING] Larger number of concurrent download pose higher risk of corrupted download and more error prone, consider lowering number of concurrent download");
if (concurrent < 1) {
    console.log("[ERROR] No or less concurrent download means no download, exiting...");
    process.exit();
}

const br = pup.launch({ headless: !["-d", "--no-headless", "--head"].some(r => argv.includes(r)) });
let dled = 0;
let outof = 0;
let sk = 0;
const pages = new Map();

let running = true;

const download = async (url, save) => exec("cd yandere && wget --header 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:100.0) Gecko/20100101 Firefox/100.0' '" + url + "'", async (t, s, e) => {
    // console.log({ t, s, e });
    if (!t && e?.match("100%")?.length) {
        await pages.get(url).close();
        pages.delete(url);
        dled++;
        console.log(dled + " pics downloaded out of " + outof + ", with " + sk + " skipped");
        if (!pages.size && (dled + sk) === outof) {
            console.log("Seems like everything downloaded, exiting...");
            process.exit();
        }
    } else {
        if (readdirSync(baseDir).includes(save)) {
            console.log("Download failed: " + save + "\nDeleting corrupted download");
            unlinkSync(join(baseDir, save));
        }
        if (!running) {
            console.log("Cancelling download for " + save);
            sk++;
            await pages.get(url).close();
            pages.delete(url);
            return;
        }
        console.log("Retrying download: " + url + " (" + save + ")");
        download(url, save);
    }
});

let skipSignal;

const sigH = async () => {
    if (pages.size) {
        console.log("Awaiting " + pages.size + " downloads to finish before exit...");
        while (pages.size) await new Promise((r, j) => setTimeout(r, 1000));
    }
};

process.stdin.on("data", (buf) => {
    const data = buf.toString().slice(0, -1);
    if (data === "s") skipSignal = true;
    else if (data === "e") {
        running = false;
        sigH().then(process.exit);
    }
});

process.on("unhandledRejection", (e) => {
    console.error({ ERROR: "[UNHANDLED_REJECTION]", REASON: e });
});

process.on("uncaughtException", (e, origin) => {
    console.error({ ERROR: "[UNCAUGHT_EXCEPTION]", MESSAGE: e, ORIGIN: origin });
});

br.then(async browser => {
    console.log("Starting up\nCLOSING THE PROGRAM CAN CORRUPT DOWNLOADS, BEWARE! ONLY ***ENTER [e]*** TO EXIT THE PROGRAM CORRECTLY!");
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:100.0) Gecko/20100101 Firefox/100.0");
    await page.goto(argv[2]);

    await page.waitForTimeout(3000);

    console.log("Gathering resources");
    let dups = 0;
    const targets = await new Promise(async (re, rj) => {
        const res = [argv[2]];
        let skipGathering;
        const tm = setTimeout(() => {
            skipGathering = true;
        }, wait_t * 1000);
        while (!skipGathering) {
            const ev = await page.evaluate(() => {
                const ts = document.getElementsByClassName("thumb");
                const ret = [];
                for (const a of ts) ret.push(a.href);
                return ret;
            });
            let added = false;
            for (const a of ev) if (!res.some(r => r.startsWith(a))) {
                res.push(a);
                added = true;
            }
            if (!added) process.stdout.write("\rGathered: " + res.length
                + " with " + (++dups) + " duplicates,"
                + " might be end of resource, enter [s] to skip if you're sure no more pics worth waiting: ");
            if (skipSignal) {
                clearTimeout(tm);
                process.stdout.write("\nSKIPPED");
                break;
            }
            await page.keyboard.press("ArrowRight");
        }
        re(res);
    });
    outof = targets.length;
    console.log("\nDownloading " + outof + " pics");
    for (const t of targets) {
        if (!running) break;
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
        let fail = 0;

        while (!url || url.endsWith("#")) {
            console.error("Can't get src for " + t);
            if (fail > 10) {
                console.error("Can't download " + t + ", skipping");
                url = null;
                break;
            }
            fail++;
            url = await eva();
        }
        fail = 0;
        if (!url) continue;

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
            console.log("Skipping " + url + " (" + save + ") as it already downloaded");
            await np.close();
            sk++;
            continue;
        }

        pages.set(url, np);
        download(url, save);
        while (pages.size >= concurrent) await new Promise((r, j) => setTimeout(r, 1000));
    }
    if (!pages.size) {
        console.log("No running download, exiting...");
        process.exit();
    }
});
