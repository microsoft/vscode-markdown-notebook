/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export interface RawNotebookCell {
	leadingWhitespace: string;
	trailingWhitespace: string;
	language: string;
	content: string;
	kind: vscode.CellKind;
}

const CODE_BLOCK_MARKER = '```';
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

export function parseMarkdown(content: string): RawNotebookCell[] {
	const lines = content.split('\n');
	let cells: RawNotebookCell[] = [];
	let i = 0;

	// Each parse function starts with line i, leaves i on the line after the last line parsed
	for (; i < lines.length;) {
		const leadingWhitespace = i === 0 ? parseWhitespaceLines(true) : '';
		if (lines[i].startsWith(CODE_BLOCK_MARKER)) {
			parseCodeBlock(leadingWhitespace);
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

	function parseCodeBlock(leadingWhitespace: string): void {
		const l = lines[i].substring(CODE_BLOCK_MARKER.length);
		const language = LANG_IDS.get(l) || l;
		const startSourceIdx = ++i;
		while (true) {
			const currLine = lines[i];
			if (i >= lines.length) {
				break;
			} else if (currLine.startsWith(CODE_BLOCK_MARKER)) {
				i++; // consume block end marker
				break;
			}

			i++;
		}

		const content = lines.slice(startSourceIdx, i - 1).join('\n');
		const trailingWhitespace = parseWhitespaceLines(false);
		cells.push({
			language,
			content,
			kind: vscode.CellKind.Code,
			leadingWhitespace: leadingWhitespace,
			trailingWhitespace: trailingWhitespace
		});
	}

	function parseMarkdownParagraph(leadingWhitespace: string): void {
		const startSourceIdx = i;
		while (true) {
			if (i >= lines.length) {
				break;
			}

			const currLine = lines[i];
			if (currLine === '') {
				break;
			}

			i++;
		}

		const content = lines.slice(startSourceIdx, i).join('\n');
		const trailingWhitespace = parseWhitespaceLines(false);
		cells.push({
			language: 'markdown',
			content,
			kind: vscode.CellKind.Markdown,
			leadingWhitespace: leadingWhitespace,
			trailingWhitespace: trailingWhitespace
		});
	}

	return cells;
}

export function writeCellsToMarkdown(cells: vscode.NotebookCell[]): string {
	let result = '';
	for (let i = 0; i < cells.length; i++) {
		const cell = cells[i];
		result += cell.metadata.custom?.leadingWhitespace || '';
		if (cell.cellKind === vscode.CellKind.Code) {
			const languageAbbrev = LANG_ABBREVS.get(cell.language) || cell.language;
			const codePrefix = CODE_BLOCK_MARKER + languageAbbrev + '\n';
			const codeSuffix = '\n' + CODE_BLOCK_MARKER;

			result += codePrefix + cell.document.getText() + codeSuffix;
		} else {
			result += cell.document.getText();
		}
		result += cell.metadata.custom?.trailingWhitespace || '';
	}
	return result;
}
