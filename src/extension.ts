/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { parseMarkdown, writeCellsToMarkdown } from './markdownParser';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.notebook.registerNotebookContentProvider('markdown', new MarkdownProvider()));
}

class MarkdownProvider implements vscode.NotebookContentProvider {
	async openNotebook(uri: vscode.Uri, _openContext: vscode.NotebookDocumentOpenContext): Promise<vscode.NotebookData> {
		const languages = ALL_LANGUAGES;
		const metadata: vscode.NotebookDocumentMetadata = { editable: true, cellEditable: true, cellHasExecutionOrder: false, cellRunnable: false, runnable: false };
		const content = Buffer.from(await vscode.workspace.fs.readFile(uri))
			.toString('utf8');

		const cellRawData = parseMarkdown(content);
		const cells = cellRawData.map(data => (<vscode.NotebookCellData>{
			cellKind: data.kind,
			language: data.language,
			metadata: { editable: true, runnable: false },
			outputs: [],
			source: data.content
		}));

		return {
			languages,
			metadata,
			cells
		};
	}

	async saveNotebook(document: vscode.NotebookDocument, cancellation: vscode.CancellationToken): Promise<void> {
		const stringOutput = writeCellsToMarkdown(document.cells);
		await vscode.workspace.fs.writeFile(document.uri, Buffer.from(stringOutput));
	}

	async saveNotebookAs(targetResource: vscode.Uri, document: vscode.NotebookDocument, cancellation: vscode.CancellationToken): Promise<void> {
		const stringOutput = writeCellsToMarkdown(document.cells);
		await vscode.workspace.fs.writeFile(targetResource, Buffer.from(stringOutput));
	}

	private _onDidChangeNotebook = new vscode.EventEmitter<vscode.NotebookDocumentEditEvent>();
	readonly onDidChangeNotebook = this._onDidChangeNotebook.event;
}

export function deactivate() { }

const ALL_LANGUAGES = [
	'plaintext',
	'bat',
	'clojure',
	'coffeescript',
	'jsonc',
	'c',
	'cpp',
	'csharp',
	'css',
	'dockerfile',
	'ignore',
	'fsharp',
	'diff',
	'go',
	'groovy',
	'handlebars',
	'hlsl',
	'html',
	'ini',
	'properties',
	'java',
	'javascriptreact',
	'javascript',
	'jsx-tags',
	'json',
	'less',
	'lua',
	'makefile',
	'markdown',
	'objective-c',
	'objective-cpp',
	'perl',
	'perl6',
	'php',
	'powershell',
	'jade',
	'python',
	'r',
	'razor',
	'ruby',
	'rust',
	'scss',
	'search-result',
	'shaderlab',
	'shellscript',
	'sql',
	'swift',
	'typescript',
	'typescriptreact',
	'vb',
	'xml',
	'xsl',
	'yaml',
	'github-issues'
];