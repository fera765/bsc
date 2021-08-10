// https://www.reddit.com/r/CryptoCurrency/comments/n9cby0/not_every_new_coin_is_a_shitcoin_how_to_spot_the/

// https://bscscan.com/tokentxns

const { firefox } = require("playwright");
const { sprintf } = require("sprintf-js");
const chalk = require('chalk');

const config = {
	findTopBaleias: 10, //buscar top 10 baleias
	baleia: 30, //acima de 30% temos muitas baleias no projeto
	lp: 30000 // ABAIXO DE 30000 LP BAIXA DE MAIS
}

function formatValue(value) {
  if (value < 1e3) return value;
  if (value >= 1e3 && value < 1e6) return `${+(value / 1e3).toFixed(1)}K`;
  if (value >= 1e6 && value < 1e9) return `${+(value / 1e6).toFixed(1)}M`;
  if (value >= 1e9 && value < 1e12) return `${+(value / 1e9).toFixed(1)}B`;
  if (value >= 1e12) return `${+(value / 1e12).toFixed(1)}T`;
  return value;
}

class DungBeetle {
	constructor(page) {
		this.page = page;
		this.shitSeen = {};
		this.shitcoinsChecked = 0;
	}

	async run() {
		await this.page.goto('https://bscscan.com/tokentxns');

		const imgs = await this.page.$$('[src="/images/main/empty-token.png"]');

		const shitCoins = {};

		for (const img of imgs) {
			const a = await img.$('xpath=..');
			const link = await a.evaluate(node => node.getAttribute('href'));
			const id = link.split('/').slice(-1)[0];
			const text = await a.evaluate(el => el.innerText);
			shitCoins[id] = text.trim();
		}

		for (const id in shitCoins) {
			if (id in this.shitSeen) continue;
			this.shitSeen[id] = true;

			const teste = `${chalk.greenBright(shitCoins[id])} https://bscscan.com/token/${id}  https://poocoin.app/tokens/${id}`;

			for (let attempt = 0; attempt < 10; attempt++) {
				try {
					await this.checkShitcoin(id, teste);
					break;
				} catch (e) {
				}
			}

			this.shitcoinsChecked++;
		}
	}

	async checkShitcoin(id, teste) {
		const steps = [
			this.checkVolume.bind(this),
			this.openBlank.bind(this),
			this.checkHolders.bind(this),
			this.checkPoocoin.bind(this)
		]

		let reasonShit;


		console.log("********************************")
		for (const step of values) {
			reasonShit = await step(id);
			if (reasonShit) {
				const top = console.log("💩💩💩", reasonShit, "\n")
				return top;
			}
		}

		console.log(teste)
		console.log("🚀🚀🚀🚀🚀\n");
		console.log("********************************")
	}

	async openBlank() {
		await this.page.goto('about:blank');
	}

	async checkVolume(id) {
		await this.page.goto('https://bscscan.com/token/' + id);
		await this.page.waitForSelector('#tokentxnsiframe');

		const elementHandle = await this.page.$('#tokentxnsiframe')
		const frame = await elementHandle.contentFrame()

		const rows = await frame.$$('#maindiv table tbody tr');
		const number = rows.length;

		const firstTime = await rows[0].evaluate(el =>
			el.querySelector('[data-original-title]').innerText
		);

		const lastTime = await rows.slice(-1)[0].evaluate(el =>
			el.querySelector('[data-original-title]').innerText
		);

		const secsPassed = (Date.parse(firstTime) - Date.parse(lastTime)) / 1000;

		const txPerMinute = (number / secsPassed) * 60;

		if (txPerMinute > 8) console.log(`${txPerMinute.toFixed(2)} TX por minuto ${chalk.blue.green("[ALTA]")}`);
		if (txPerMinute > 5 && txPerMinute < 8) console.log(`${txPerMinute.toFixed(2)} TX por minuto ${chalk.blue("[MEDIA]")}`);
		if (txPerMinute < 5) return `${txPerMinute.toFixed(2)} TX por minuto ${chalk.red("[BAIXA]")}`;
	}

	async checkHolders(id) {
		await this.page.goto(`https://bscscan.com/token/${id}#balances`);
		await this.page.waitForSelector('#tokeholdersiframe')

		const elementHandle = await this.page.$('#tokeholdersiframe')
		const frame = await elementHandle.contentFrame()

		const rows = await frame.$$('#maintable table tbody tr');

		let whaleNumber = 0;
		let lpPercentage = 0;
		let deadPercentage = 0;
		let whalePercentage = 0;

		for (const row of rows) {
			const addressA = await row.$('td:nth-child(2) a');
			const link = await addressA.evaluate(node => node.getAttribute('href'));
			const address = link.split('=').slice(-1)[0]
			const text = await addressA.evaluate(el => el.innerText);

			let percentage = await row.evaluate(el => el.querySelector('[aria-valuenow]').getAttribute('aria-valuenow'));
			percentage = parseFloat(percentage);

			if (/^PancakeSwap/.test(text)) {
				lpPercentage += percentage;
			} else if (/^0x0000000000/.test(address)) {
				deadPercentage += percentage;

				// https://poocoin.app/rugcheck/0xebdf1b978dc2576ef0020ba4cf5f98174425c3a1
				// maybe we should multiple whales by 1/(1-DEAD)?
			} else {
				whaleNumber++;
				whalePercentage += percentage;

				if (whaleNumber === config.findTopBaleias) break;
			}
		}

		console.log(sprintf('Liquidez de Pool %.2f % QUEIMADA %.2f % TOP 10 Baleias %.2f %', lpPercentage, deadPercentage, whalePercentage));

		if (lpPercentage + deadPercentage < 50) {
			return chalk.red("Not enought LP + DEAD %");
		} else if (whalePercentage > config.baleia) {
			return chalk.red("Baleias muito alta");
		}
	}

	async checkPoocoin(id) {
		await this.page.goto("https://poocoin.app/tokens/" + id);
		await this.page.waitForSelector('.px-3 .text-success');

		const elements = await this.page.$$('.px-3 .text-success');
    console.log(id)

		let attempt = 0;

		while (true) {
			attempt++;

			const html = await this.page.content();
			if (html.includes("BNB LP does not exist for this token")) return "No LP";

			// if (html.includes("BNB LP does not exist for this token")) return "No LP";

			const mCap = await elements[0].evaluate(el => el.innerText);
			if (mCap !== "$") break;

			if (attempt >= 1000) return "Timeout fetching LP size";
			await sleep(100);
		}

		const lp = await elements[1].evaluate(el => parseInt(el.innerText.replace(/\D/g, '')));

		console.log("LP size: $" + formatValue((lp / 1000).toFixed(0)));

		if (lp < config.lp) return "Low LP";
	}

	async p(el) {
		const val = await el.evaluate(el => el.outerHTML);
		console.log(val);
	}
}

async function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeBrowser() {
	return await firefox.launch({
		headless: true, // poocoin uses cloudflare -> doesn't work headless
		args: [
			'--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
			'--disable-background-timer-throttling',
			'--disable-backgrounding-occluded-windows',
			'--disable-renderer-backgrounding',
		],
		firefoxUserPrefs: {
			"places.history.enabled": false,
			"browser.sessionstore.max_tabs_undo": 0
		}
	});
}

(async () => {
	let browser = await makeBrowser();
	let context = await browser.newContext();
	const db = new DungBeetle(await context.newPage());

	while (true) {
		if (db.shitcoinsChecked >= 50) { // refresh page to clear memory
			await browser.close();
			browser = await makeBrowser();
			context = await browser.newContext();
			db.page = await context.newPage();
			db.shitcoinsChecked = 0;
		}

		await db.run();
	}
})();


