/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';

export interface RawNotebookCell {
	indentation?: string;
	leadingWhitespace: string;
	trailingWhitespace: string;
	language: string;
	content: string;
	kind: vscode.NotebookCellKind;
	isEmbeddedYaml?: boolean;
	yaml?: object | string | number | null | undefined;
}

const LANG_IDS = new Map([
	['bat', 'batch'],
	['c++', 'cpp'],
	['js', 'javascript'],
	['ts', 'typescript'],
	['cs', 'csharp'],
	['py', 'python'],
	['py2', 'python'],
	['py3', 'python'],
]);
const LANG_ABBREVS = new Map(
	Array.from(LANG_IDS.keys()).map(k => [LANG_IDS.get(k), k])
);

interface ICodeBlockStart {
	langId: string;
	indentation: string
}

/**
 * Note - the indented code block parsing is basic. It should only be applied inside lists, indentation should be consistent across lines and
 * between the start and end blocks, etc. This is good enough for typical use cases.
 */
function parseCodeBlockStart(line: string): ICodeBlockStart | null {
	const match = line.match(/(    |\t)?```(\S*)/);
	return match && {
		indentation: match[1],
		langId: match[2]
	};
}

function isCodeBlockStart(line: string): boolean {
	return !!parseCodeBlockStart(line);
}

function isCodeBlockEndLine(line: string): boolean {
	return !!line.match(/^\s*```/);
}

export function parseMarkdown(content: string): RawNotebookCell[] {
	const lines = content.split(/\r?\n/g);
	let cells: RawNotebookCell[] = [];
	let i = 0;

	// Each parse function starts with line i, leaves i on the line after the last line parsed
	for (; i < lines.length;) {
		const leadingWhitespace = i === 0 ? parseWhitespaceLines(true) : '';
		if (cells.length === 0 && lines[i] === '---') {
			if (parseEmbeddedYAML(leadingWhitespace)) {
				continue;
			}
		}

		const codeBlockMatch = parseCodeBlockStart(lines[i]);
		if (codeBlockMatch) {
			parseCodeBlock(leadingWhitespace, codeBlockMatch);
		} else {
			parseMarkdownParagraph(leadingWhitespace);
		}
	}

	function parseWhitespaceLines(isFirst: boolean): string {
		let start = i;
		const nextNonWhitespaceLineOffset = lines.slice(start).findIndex(l => l !== '');
		let end: number; // will be next line or overflow
		let isLast = false;
		if (nextNonWhitespaceLineOffset < 0) {
			end = lines.length;
			isLast = true;
		} else {
			end = start + nextNonWhitespaceLineOffset;
		}

		i = end;
		const numWhitespaceLines = end - start + (isFirst || isLast ? 0 : 1);
		return '\n'.repeat(numWhitespaceLines);
	}

	function parseCodeBlock(leadingWhitespace: string, codeBlockStart: ICodeBlockStart): void {
		const language = LANG_IDS.get(codeBlockStart.langId) || codeBlockStart.langId;
		const startSourceIdx = ++i;
		while (true) {
			const currLine = lines[i];
			if (i >= lines.length) {
				break;
			} else if (isCodeBlockEndLine(currLine)) {
				i++; // consume block end marker
				break;
			}

			i++;
		}

		const content = lines.slice(startSourceIdx, i - 1)
			.map(line => line.replace(new RegExp('^' + codeBlockStart.indentation), ''))
			.join('\n');
		const trailingWhitespace = parseWhitespaceLines(false);
		cells.push({
			language,
			content,
			kind: vscode.NotebookCellKind.Code,
			leadingWhitespace: leadingWhitespace,
			trailingWhitespace: trailingWhitespace,
			indentation: codeBlockStart.indentation
		});
	}

	function parseMarkdownParagraph(leadingWhitespace: string): void {
		const startSourceIdx = i;
		while (true) {
			if (i >= lines.length) {
				break;
			}

			const currLine = lines[i];
			if (currLine === '' || isCodeBlockStart(currLine)) {
				break;
			}

			i++;
		}

		const content = lines.slice(startSourceIdx, i).join('\n');
		const trailingWhitespace = parseWhitespaceLines(false);
		cells.push({
			language: 'markdown',
			content,
			kind: vscode.NotebookCellKind.Markdown,
			leadingWhitespace: leadingWhitespace,
			trailingWhitespace: trailingWhitespace
		});
	}

	function parseEmbeddedYAML(leadingWhitespace: string): boolean {
		const startSourceIdx = ++i;
		while (true) {
			if (i >= lines.length) {
				i = startSourceIdx - 1;
				return false;
			}

			const currLine = lines[i++];
			if (currLine === '---') {
				break;
			}
		}

		const content = lines.slice(startSourceIdx, i-1).join('\n');
		let result: object | string | number | null | undefined;
		try {
			result = yaml.load(content);
		} catch (_) {
			i = startSourceIdx - 1;
			return false;
		}

		const trailingWhitespace = parseWhitespaceLines(false);
		cells.push({
			language: 'yaml',
			content,
			kind: vscode.NotebookCellKind.Code,
			leadingWhitespace: leadingWhitespace,
			trailingWhitespace: trailingWhitespace,
			isEmbeddedYaml: true,
			yaml: result,
		});
		return true;
	}

	return cells;
}

export function writeCellsToMarkdown(cells: ReadonlyArray<vscode.NotebookCell>): string {
	let result = '';
	for (let i = 0; i < cells.length; i++) {
		const cell = cells[i];
		if (i === 0) {
			result += cell.metadata.custom?.leadingWhitespace ?? '';
		}

		if (cell.kind !== vscode.NotebookCellKind.Code) {
			result += cell.document.getText();
		} else if (cell.metadata.custom?.isEmbeddedYaml) {
			result += `---\n${cell.document.getText()}\n---`;
		} else {
			const indentation = cell.metadata.custom?.indentation || '';
			const languageAbbrev = LANG_ABBREVS.get(cell.document.languageId) ?? cell.document.languageId;
			const codePrefix = indentation + '```' + languageAbbrev + '\n';
			const contents = cell.document.getText().split(/\r?\n/g)
				.map(line => indentation + line)
				.join('\n');
			const codeSuffix = '\n' + indentation + '```';

			result += codePrefix + contents + codeSuffix;
		}

		result += getBetweenCellsWhitespace(cells, i);
	}
	return result;
}

function getBetweenCellsWhitespace(cells: ReadonlyArray<vscode.NotebookCell>, idx: number): string {
	const thisCell = cells[idx];
	const nextCell = cells[idx + 1];

	if (!nextCell) {
		return thisCell.metadata.custom?.trailingWhitespace ?? '\n';
	}

	const trailing = thisCell.metadata.custom?.trailingWhitespace;
	const leading = nextCell.metadata.custom?.leadingWhitespace;

	if (typeof trailing === 'string' && typeof leading === 'string') {
		return trailing + leading;
	}

	// One of the cells is new
	const combined = (trailing ?? '') + (leading ?? '');
	if (!combined || combined === '\n') {
		return '\n\n';
	}

	return combined;
}
