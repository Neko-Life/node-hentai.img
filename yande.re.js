"use strict";
const fs = require("fs");
const { argv } = require("process");
const puppeteer = require("puppeteer");
const { exec } = require("child_process");

let startTime, endTime;
let processes = new Map();

function start() {
	startTime = Date.now();
};

function end() {
	endTime = Date.now();
	var timeDiff = endTime - startTime;
	timeDiff /= 1000;
	var seconds = Math.round(timeDiff);
	console.log("\nFinished in " + seconds + " seconds");
}

async function getProperUrl(page, url) {
	await page.goto(url);
	await page.waitForTimeout(500);
	const properUrl = await page.evaluate(() => {
		const png = document.getElementsByClassName("download-png")[0].href;
		const jpeg = document.getElementsByClassName("download-jpeg")[0]?.href;
		const main = document.getElementsByClassName("main-image")[0]?.src;
		const image = document.getElementsByClassName("download-image")[0]?.href;
		
		if (png && !png.includes('#'))
		return png;
		else if (jpeg && !jpeg.includes('#'))
		return jpeg;
		else if (main && !main.includes('#'))
		return main;
		else if (image && !image.includes('#'))
		return image;
		else 
		return undefined;
	})
	page.close();
	return properUrl;
}

const download = async (url) => {
	if (url)
	processes.set(url);
	exec(`wget -N -c \
	--secure-protocol=auto \
	--no-http-keep-alive \
	--tries=0 --timeout=10 \
	--random-wait \
	--accept jpg,jpeg,png \
	-P yandere "${url}"`, async (err, stdout, stderr) => {
		if (!err) {
			processes.delete(url);
		} else if (err.toString().includes("404")) {
			processes.delete(url);
			if (url.includes("image"))
			download(url.replace("image", "jpeg"))
			else 
			download(url.replace("jpeg", "sample"))
		} else {
			download(url);
		}
	});
};

function extractItems() {
	const extractedElements = document.getElementsByClassName("thumb");
	const items = [];
	for (let element of extractedElements) {
		items.push(element.href);
	}
	return items;
}

async function scrapeItems(page, extractItems, itemCount, maxAttempts) {
	let items = [];
	
	let condition = true;
	let timeout;
	let prevLength = items.length;
	
	console.log("Waiting for the page to load...");
	await page.waitForTimeout(1000);
	try {
		
		console.log("Scraping...");
		while (condition) {
			
			prevLength = items.length;
			let grabbed = await page.evaluate(extractItems);
			for (const item of grabbed) if (!items.includes(item)) items.push(item);
			if (items.length === prevLength) timeout++; else {timeout = 0; process.stdout.write(`\rFound ${items.length} Items!`);};
			if (timeout === maxAttempts || items.length === itemCount) condition = false;
			await page.keyboard.press("ArrowRight");
		}
	} catch (err) {
		console.log(err);
	}
	page.close();
	return items;
}

async function getEPages(page) {
	await page.waitForTimeout(1000);
	const pages = await page.evaluate(() => {
		return document.querySelectorAll('a[aria-label]')[5].innerHTML;
	});
	return parseInt(pages);
}

async function getEUrl(page, url) {
	await page.goto(url);
	await page.waitForTimeout(500);
	
	const res = await page.evaluate(() => {
		let urlMap = [];
		const elements = document.querySelectorAll('ul[id="post-list-posts"] li a[class="directlink largeimg"]');
		for (let i = 0; i < elements.length; i++)
		urlMap.push(elements[i].href.replace(elements[i].href.includes('jpeg') ? 'jpeg' : 'sample', 'image'));
		return urlMap;
	})
	page.close();
	return res;
}

(async () => {
	const category = argv[2];
	start();
	
	const eYandereURL = `https://yande.re/post?tags=` + category;
	const yandereURL = 'https://yande.re/post/browse#/' + category;
	
	console.log("Starting Chromium environment...");
	const browser = await puppeteer.launch({
		headless: true,
		args: ['--no-sandbox', '--disable-setuid-sandbox'],
	});
	let properUrlList = [];
	
	console.log("Chromium started!\nGoing to page...");
	const page = await browser.newPage();
	
	if (argv.includes('--explicit')) {
		let pages;
		console.log('Explicit tag enabled, BEWARE! May contain NSFW content!')
		await page.goto(eYandereURL);
		
		if (argv[argv.indexOf('--explicit') + 1]){
			pages = parseInt(argv[argv.indexOf('--explicit', 3) + 1]);
		} else {
			pages = await getEPages(page);
			console.log(`ATTENTION!!!!\n YOU DID NOT INPUT A PARAMETER FOR THE PAGES AND WILL BE ATTEMPTING TO DOWNLOAD ~${pages * 40} ITEMS!!!`)
		}
		console.log(`${pages} pages found!`);
		page.close();
		
		for (let currPage = 1; currPage <= pages; currPage++) {
			const currPageUrl = eYandereURL + `&page=${currPage}`;
			const elementPage = await browser.newPage();
			process.stdout.write(`\rScrolling page ${currPage}`);
			properUrlList.push(getEUrl(elementPage, currPageUrl));
		}
	} else {
		await page.goto(yandereURL);
		
		console.log("Starting scraping procedure...");
		const items = await scrapeItems(page, extractItems, 1000, 1000);
		page.close();
		
		console.log("\nProcessing URLs...");
		for (const [index, element] of items.entries()) {
			const elementPage = await browser.newPage();
			process.stdout.write(`\rProcessing item: ${index + 1}`);
			properUrlList.push(getProperUrl(elementPage, element));
		}
	}
	properUrlList = await Promise.all(properUrlList).catch(err => console.log(err));
	console.log("\nFinished getting available high res URLs! Closing browser");
	properUrlList = properUrlList.flat(2);
	await browser.close();

	try {
		fs.readdirSync("yandere");
	} catch (err) {
		console.log("Preparing folder...")
		fs.mkdirSync("yandere");
	}
	
	console.log("Downloading images...");
	for (let index = 0; index < properUrlList.length; index++) {
		if (properUrlList[index]) {
			process.stdout.write(`\rInitiating download for item: ${index + 1}`);
			download(properUrlList[index]);
		}
	}
	console.log('\nPlease wait for all the downloads to complete!')
	while(processes.size != 0) {
		process.stdout.write(`\r${(processes.size)} Items remaining to be downloaded.`);
		await new Promise((re,rj) => setTimeout(re, 5000));
	}
	end();
})();
