// fetchNews.js
import RSSParser from "rss-parser";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import OpenAI from "openai";

const parser = new RSSParser();

// 从环境变量读取
const SHEET_ID = process.env.SHEET_ID;
const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 用 jwtClient 替代旧认证
const jwtClient = new JWT({
  email: creds.client_email,
  key: creds.private_key.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

async function run() {
  try {
    // 这行把 JWT 客户端传入 GoogleSpreadsheet 构造函数
    const doc = new GoogleSpreadsheet(SHEET_ID, jwtClient);

    // 载入表格信息
    await doc.loadInfo();

    const sheet = doc.sheetsByIndex[0];

    const feed = await parser.parseURL(
      "https://www.cbc.ca/webfeed/rss/rss-topstories"
    );

    const item = feed.items[0];
    const titleEn = item.title;
    const summaryEn = item.contentSnippet || "";

    // 用 OpenAI 翻译
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

    // 写入 Google Sheet
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
