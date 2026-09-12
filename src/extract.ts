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

export const MAX_SECTION_CHARS = 4_000;

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
    sections: sectionizeMarkdown(markdown, title),
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

export function sectionizeMarkdown(markdown: string, title: string): ExtractedSection[] {
  const rawSections: Array<Omit<ExtractedSection, "ordinal">> = [];
  const stack: Array<{ level: number; heading: string }> = [];
  let current: { headingPath: string[]; lines: string[] } | undefined;

  const flush = () => {
    if (!current) return;
    rawSections.push({
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
    while (stack.at(-1)?.level !== undefined && (stack.at(-1)?.level ?? 0) >= level) {
      stack.pop();
    }
    stack.push({ level, heading });
    current = {
      headingPath: stack.map((item) => item.heading),
      lines: [line],
    };
  }

  flush();
  if (rawSections.length > 0) {
    return rawSections
      .flatMap((section) =>
        splitSectionBody(section.body, MAX_SECTION_CHARS).map((body) => ({ ...section, body })),
      )
      .map((section, ordinal) => ({ ...section, ordinal }));
  }

  return [
    {
      ordinal: 0,
      headingPath: [],
      title,
      body: markdown,
    },
  ];
}

function splitSectionBody(body: string, maximumCharacters: number): string[] {
  if (body.length <= maximumCharacters) return [body];

  const chunks: string[] = [];
  let current = "";
  for (const paragraph of body.split(/\n{2,}/)) {
    const paragraphChunks = splitText(paragraph, maximumCharacters);
    for (const paragraphChunk of paragraphChunks) {
      const candidate = current ? `${current}\n\n${paragraphChunk}` : paragraphChunk;
      if (candidate.length <= maximumCharacters) {
        current = candidate;
      } else {
        if (current) chunks.push(current);
        current = paragraphChunk;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [body.slice(0, maximumCharacters)];
}

function splitText(value: string, maximumCharacters: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < value.length) {
    const remaining = value.length - start;
    if (remaining <= maximumCharacters) {
      const tail = value.slice(start).trim();
      if (tail) chunks.push(tail);
      break;
    }

    let end = start + maximumCharacters;
    while (end > start && !/\s/.test(value[end - 1] ?? "")) end -= 1;
    if (end === start) end = start + maximumCharacters;
    const chunk = value.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    start = end;
    while (start < value.length && /\s/.test(value[start] ?? "")) start += 1;
  }
  return chunks;
}
