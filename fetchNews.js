import RSSParser from "rss-parser";
import { GoogleSpreadsheet } from "google-spreadsheet";
import OpenAI from "openai";

const parser = new RSSParser();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SHEET_ID = process.env.SHEET_ID;
const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

async function run() {
  // ⚡ 新版写法：把 creds 直接传给 GoogleSpreadsheet
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: creds.client_email,
    private_key: creds.private_key,
  });

  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];

  const feed = await parser.parseURL(
    "https://www.cbc.ca/webfeed/rss/rss-topstories"
  );

  const item = feed.items[0];

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
}

run();
