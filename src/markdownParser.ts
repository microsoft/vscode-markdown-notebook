/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export interface RawNotebookCell {
	// leadingWhitespace: string;
	// trailingWhitespace: string;
	language: string;
	content: string;
	kind: vscode.CellKind;
}

const CODE_BLOCK_MARKER = '```';
const LANG_FULLNAMES = new Map([
	['bat', 'batch'],
	['c++', 'cpp'],
	['js', 'javascript'],
	['cs', 'csharp'],
	['py', 'python'],
	['py2', 'python'],
	['py3', 'python'],
]);
const LANG_ABBREVS = new Map(
	Array.from(LANG_FULLNAMES.keys()).map(k => [LANG_FULLNAMES.get(k), k])
);

export function parseMarkdown(content: string): RawNotebookCell[] {
	const lines = content.trim().split('\n');
	let cells: RawNotebookCell[] = [];
	let i = 0;
	for (; i < lines.length; i++) {
		while (lines[i] === '') {
			// Eat extra whitespace lines
			i++;
		}

		if (lines[i].startsWith(CODE_BLOCK_MARKER)) {
			parseCodeBlock();
		} else {
			parseMarkdownParagraph();
		}
	}

	function parseCodeBlock(): void {
		const l = lines[i].substring(CODE_BLOCK_MARKER.length);
		const language = LANG_FULLNAMES.get(l) || l;
		const startSourceIdx = ++i;
		let endSourceIdx: number;
		while (true) {
			const currLine = lines[i];
			if (!currLine) {
				endSourceIdx = i;
				break;
			} else if (currLine.startsWith(CODE_BLOCK_MARKER)) {
				endSourceIdx = i - 1;
				break;
			}

			i++;
		}

		const content = lines.slice(startSourceIdx, endSourceIdx + 1).join('\n');
		cells.push({ language, content, kind: vscode.CellKind.Code });
	}

	function parseMarkdownParagraph(): void {
		const startSourceIdx = i;
		let endSourceIdx: number;
		while (true) {
			const currLine = lines[++i];
			if (!currLine) {
				endSourceIdx = i;
				break;
			} else if (currLine === '') {
				endSourceIdx = i - 1;
				break;
			}
		}

		const content = lines.slice(startSourceIdx, endSourceIdx + 1).join('\n');
		cells.push({ language: 'markdown', content, kind: vscode.CellKind.Markdown });
	}

	return cells;
}

export function writeCellsToMarkdown(cells: vscode.NotebookCell[]): string {
	let result = '';
	for (let i = 0; i < cells.length; i++) {
		const cell = cells[i];
		if (cell.cellKind === vscode.CellKind.Code) {
			const languageAbbrev = LANG_ABBREVS.get(cell.language);
			const codePrefix = CODE_BLOCK_MARKER + languageAbbrev + '\n';
			const codeSuffix = '\n' + CODE_BLOCK_MARKER + '\n\n';

			result += codePrefix + cell.document.getText() + codeSuffix;
		} else {
			result += cell.document.getText() + '\n';
		}
	}
	return result;
}
