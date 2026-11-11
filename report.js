'use strict';

const titleElement = document.querySelector('#report-title');
const weekElement = document.querySelector('#report-week');
const article = document.querySelector('#report-content');
const errorCard = document.querySelector('#report-error');
const toc = document.querySelector('#report-toc');
const sourceLink = document.querySelector('#source-link');

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function resolveLink(rawUrl, sourceUrl) {
  const url = new URL(rawUrl, sourceUrl);
  if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return null;
  return url.href;
}

function inlineMarkdown(text, sourceUrl) {
  const tokens = [];
  const stash = html => {
    const key = `@@TOKEN${tokens.length}@@`;
    tokens.push(html);
    return key;
  };

  text = text.replace(/`([^`]+)`/g, (_, code) => stash(`<code>${escapeHtml(code)}</code>`));
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt, rawUrl, caption) => {
    const url = resolveLink(rawUrl, sourceUrl);
    return url ? stash(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${caption ? ` title="${escapeHtml(caption)}"` : ''} loading="lazy">`) : escapeHtml(alt);
  });
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, label, rawUrl, caption) => {
    const url = resolveLink(rawUrl, sourceUrl);
    if (!url) return escapeHtml(label);
    const external = new URL(url).origin !== location.origin;
    return stash(`<a href="${escapeHtml(url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}${caption ? ` title="${escapeHtml(caption)}"` : ''}>${escapeHtml(label)}</a>`);
  });

  let html = escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>');
  return html.replace(/@@TOKEN(\d+)@@/g, (_, index) => tokens[Number(index)]);
}

function isTableDelimiter(line) {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

function makeSlug(text, counts) {
  const base = text.toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
  const count = counts.get(base) || 0;
  counts.set(base, count + 1);
  return count ? `${base}-${count + 1}` : base;
}

function renderMarkdown(markdown, sourceUrl) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const headingCounts = new Map();
  const tocItems = [];
  const sections = [];
  let section = null;
  let firstHeading = '';
  let description = '';
  let preamble = [];

  const closeSection = () => {
    if (section) sections.push(section);
    section = null;
  };
  const addBlock = html => {
    if (section) section.blocks.push(html);
    else preamble.push(html);
  };
  const isBlockStart = index => {
    const line = lines[index] || '';
    return /^\s*(```|#{1,6}\s|>\s?|\|)/.test(line)
      || /^\s*([-*+]\s|\d+\.\s)/.test(line)
      || /^\s*([-*_]\s*){3,}$/.test(line);
  };

  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (/^\s*```/.test(line)) {
      const language = line.trim().slice(3).trim().split(/\s+/)[0] || '';
      const codeLines = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) codeLines.push(lines[i++]);
      if (i < lines.length) i++;
      addBlock(`<pre><code${/^[\w+-]+$/.test(language) ? ` class="language-${escapeHtml(language)}"` : ''}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const plainTitle = heading[2].replace(/[`*_~]/g, '');
      const id = makeSlug(plainTitle, headingCounts);
      if (level === 1 && !firstHeading) {
        firstHeading = plainTitle;
        i++;
        continue;
      }
      if (level === 2) {
        closeSection();
        section = { heading: `<h2 id="${id}">${inlineMarkdown(heading[2], sourceUrl)}</h2>`, blocks: [] };
      } else {
        if (level === 3 && section) tocItems.push({ level, id, title: plainTitle });
        if (level === 2) tocItems.push({ level, id, title: plainTitle });
        addBlock(`<h${level} id="${id}">${inlineMarkdown(heading[2], sourceUrl)}</h${level}>`);
      }
      if (level === 2) tocItems.push({ level, id, title: plainTitle });
      i++;
      continue;
    }

    if (i + 1 < lines.length && line.includes('|') && isTableDelimiter(lines[i + 1])) {
      const headers = splitTableRow(line);
      const alignments = splitTableRow(lines[i + 1]).map(cell => {
        if (/^:-+:$/.test(cell)) return 'center';
        if (/^-+:$/.test(cell)) return 'right';
        if (/^:-+$/.test(cell)) return 'left';
        return '';
      });
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(splitTableRow(lines[i++]));
      const headerHtml = headers.map((cell, index) => `<th${alignments[index] ? ` style="text-align:${alignments[index]}"` : ''}>${inlineMarkdown(cell, sourceUrl)}</th>`).join('');
      const bodyHtml = rows.map(row => `<tr>${headers.map((_, index) => `<td${alignments[index] ? ` style="text-align:${alignments[index]}"` : ''}>${inlineMarkdown(row[index] || '', sourceUrl)}</td>`).join('')}</tr>`).join('');
      addBlock(`<div class="table-wrap"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`);
      continue;
    }

    if (/^\s*([-*_]\s*){3,}$/.test(line)) {
      addBlock('<hr>');
      i++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quoteLines.push(lines[i++].replace(/^\s*>\s?/, '').trim());
      const quoteText = quoteLines.filter(Boolean).join(' ');
      addBlock(`<blockquote><p>${inlineMarkdown(quoteText, sourceUrl)}</p></blockquote>`);
      continue;
    }

    const listMatch = line.match(/^\s*([-*+])\s+|^\s*(\d+)\.\s+/);
    if (listMatch) {
      const ordered = Boolean(listMatch[2]);
      const items = [];
      while (i < lines.length) {
        const itemMatch = lines[i].match(/^\s*([-*+])\s+(.+)$|^\s*(\d+)\.\s+(.+)$/);
        if (!itemMatch || Boolean(itemMatch[3]) !== ordered) break;
        const content = itemMatch[2] || itemMatch[4];
        const checkbox = content.match(/^\[([ xX])\]\s*(.*)$/);
        const item = checkbox
          ? `<label class="task-item"><input type="checkbox" disabled${checkbox[1].toLowerCase() === 'x' ? ' checked' : ''}> ${inlineMarkdown(checkbox[2], sourceUrl)}</label>`
          : inlineMarkdown(content, sourceUrl);
        items.push(`<li>${item}</li>`);
        i++;
      }
      addBlock(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }

    if (line.includes('|')) {
      addBlock(`<p>${inlineMarkdown(line, sourceUrl)}</p>`);
      i++;
      continue;
    }

    const paragraph = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() && !isBlockStart(i)) paragraph.push(lines[i++].trim());
    addBlock(`<p>${inlineMarkdown(paragraph.join(' '), sourceUrl)}</p>`);
  }
  closeSection();

  const renderedSections = [
    ...(preamble.length ? [`<section class="report-section">${preamble.join('')}</section>`] : []),
    ...sections.map(item => `<section class="report-section">${item.heading}${item.blocks.join('')}</section>`),
  ];
  return { title: firstHeading, html: renderedSections.join(''), tocItems };
}

async function loadReport() {
  const params = new URLSearchParams(location.search);
  const sourcePath = params.get('src') || '';
  if (!/^week[2-7]\/week[2-7]\.md$/.test(sourcePath)) {
    throw new Error('보고서 경로가 올바르지 않습니다. 주차 목록에서 보고서를 선택해 주세요.');
  }

  const sourceUrl = new URL(sourcePath, location.href);
  sourceLink.href = sourceUrl.href;
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`보고서를 불러오지 못했습니다 (HTTP ${response.status}).`);

  const markdown = await response.text();
  const rendered = renderMarkdown(markdown, sourceUrl);
  if (!rendered.title) throw new Error('보고서 제목을 찾을 수 없습니다.');

  const weekNumber = sourcePath.match(/^week(\d+)/)[1];
  titleElement.textContent = rendered.title;
  weekElement.textContent = `WEEK ${weekNumber}`;
  document.title = `${rendered.title} · 컴퓨터 그래픽스 보고서`;
  article.innerHTML = rendered.html;

  toc.innerHTML = rendered.tocItems.map(item =>
    `<a class="level-${item.level}" href="#${escapeHtml(item.id)}">${escapeHtml(item.title)}</a>`
  ).join('');
  if (!rendered.tocItems.length) toc.parentElement.hidden = true;
}

loadReport().catch(error => {
  errorCard.hidden = false;
  errorCard.textContent = error.message;
  titleElement.textContent = '보고서를 열 수 없습니다';
  weekElement.textContent = 'LOAD ERROR';
});
