import { parseHTML } from "linkedom";
import TurndownService from "turndown";

export interface ExtractedSection {
  ordinal: number;
  headingPath: string[];
  title: string;
  body: string;
}

export interface ExtractedPage {
  url: string;
  title: string;
  articleHtml: string;
  markdown: string;
  sections: ExtractedSection[];
  links: string[];
}

const turndown = new TurndownService({
  codeBlockStyle: "fenced",
  headingStyle: "atx",
});

export function extractPage(html: string, url: string): ExtractedPage {
  const { document } = parseHTML(html);
  const source = selectContent(document);
  const content = source.cloneNode(true) as Element;

  for (const element of Array.from(
    content.querySelectorAll("nav, header, footer, script, style, svg, form, input, button"),
  )) {
    element.remove();
  }

  const articleHtml = content.innerHTML.trim();
  if (articleHtml.length === 0) {
    throw new Error(`Documentation page has no article content: ${url}`);
  }

  const headingTitle = content.querySelector("h1")?.textContent?.trim() ?? "";
  const documentTitle = document.querySelector("title")?.textContent?.trim() ?? "";
  const title = headingTitle || documentTitle.split(" · ")[0]?.trim() || new URL(url).pathname;
  const markdown = turndown.turndown(articleHtml).trim();
  if (markdown.length === 0) {
    throw new Error(`Documentation page produced empty Markdown: ${url}`);
  }

  return {
    url,
    title,
    articleHtml,
    markdown,
    sections: splitSections(markdown, title),
    links: Array.from(content.querySelectorAll("a"))
      .map((anchor) => anchor.getAttribute("href"))
      .filter((href): href is string => href !== null && href.trim().length > 0),
  };
}

function selectContent(document: Document): Element {
  return (
    document.querySelector("article") ??
    document.querySelector("main") ??
    document.querySelector('[role="main"]') ??
    document.body
  );
}

function splitSections(markdown: string, title: string): ExtractedSection[] {
  const sections: ExtractedSection[] = [];
  const stack: string[] = [];
  let current: { headingPath: string[]; heading: string; lines: string[] } | undefined;

  const flush = () => {
    if (!current) return;
    sections.push({
      ordinal: sections.length,
      headingPath: current.headingPath,
      title,
      body: current.lines.join("\n").trim(),
    });
  };

  for (const line of markdown.split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) {
      if (current) current.lines.push(line);
      continue;
    }

    flush();
    const hashes = match[1];
    const matchedHeading = match[2];
    if (!hashes || !matchedHeading) continue;
    const level = hashes.length;
    const heading = matchedHeading.trim();
    stack.splice(level - 1);
    stack[level - 1] = heading;
    current = {
      headingPath: stack.slice(0, level),
      heading,
      lines: [line],
    };
  }

  flush();
  if (sections.length > 0) return sections;

  return [
    {
      ordinal: 0,
      headingPath: [],
      title,
      body: markdown,
    },
  ];
}
