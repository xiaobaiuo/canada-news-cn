import RSSParser from "rss-parser";
import { GoogleSpreadsheet } from "google-spreadsheet";
import OpenAI from "openai";

// 初始化 RSS Parser 和 OpenAI
const parser = new RSSParser();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 从 Secrets 读取 Google Sheet ID 和 Service Account
const SHEET_ID = process.env.SHEET_ID;
const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

async function run() {
  try {
    // 初始化 Google Sheet
    const doc = new GoogleSpreadsheet(SHEET_ID);

    // 新版 google-spreadsheet 认证方法
    await doc.useServiceAccountAuth({
      client_email: creds.client_email,
      private_key: creds.private_key.replace(/\\n/g, '\n')
    });

    await doc.loadInfo(); // 加载文档信息
    const sheet = doc.sheetsByIndex[0]; // 选择第一个表格

    // 抓取 CBC 最新新闻
    const feed = await parser.parseURL("https://www.cbc.ca/webfeed/rss/rss-topstories");
    const item = feed.items[0]; // 最新一条新闻

    // 调用 OpenAI 翻译
    const prompt = `
请把下面英文新闻翻译成中文（只要标题和摘要）：

Title: ${item.title}
Summary: ${item.contentSnippet}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }]
    });

    const cn = completion.choices[0].message.content;

    // 写入 Google Sheet
    await sheet.addRow({
      title_en: item.title,
      title_cn: cn.split("\n")[0],
      summary_en: item.contentSnippet,
      summary_cn: cn,
      link: item.link,
      source: "CBC",
      published_at: item.pubDate
    });

    console.log("✅ 写入成功");
  } catch (err) {
    console.error("❌ 出错了:", err);
  }
}

// 运行
run();
