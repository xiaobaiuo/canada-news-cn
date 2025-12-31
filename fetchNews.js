// fetchNews.js
import RSSParser from "rss-parser";
import { GoogleSpreadsheet } from "google-spreadsheet";
import OpenAI from "openai";

const parser = new RSSParser();
const SHEET_ID = process.env.SHEET_ID;
const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function run() {
  try {
    // 1️⃣ 连接 Google Sheet（最新版写法）
    const doc = new GoogleSpreadsheet(SHEET_ID);
    await doc.useServiceAccountAuth({
      client_email: creds.client_email,
      private_key: creds.private_key.replace(/\\n/g, "\n"),
    });
    await doc.loadInfo();

    const sheet = doc.sheetsByIndex[0];

    // 2️⃣ 抓取 CBC RSS 最新新闻
    const feed = await parser.parseURL(
      "https://www.cbc.ca/webfeed/rss/rss-topstories"
    );

    const item = feed.items[0];
    const titleEn = item.title;
    const summaryEn = item.contentSnippet || "";

    // 3️⃣ 翻译成中文
    const prompt = `
请把下面英文新闻翻译成中文（只要标题和摘要）：

Title: ${titleEn}
Summary: ${summaryEn}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const cn = completion.choices[0].message.content;

    // 4️⃣ 写入 Google Sheets
    await sheet.addRow({
      title_en: titleEn,
      title_cn: cn.split("\n")[0],
      summary_en: summaryEn,
      summary_cn: cn,
      link: item.link,
      source: "CBC",
      published_at: item.pubDate,
    });

    console.log("✅ 写入成功");
  } catch (err) {
    console.error("❌ 出错啦：", err);
  }
}

run();
