/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { parseMarkdown, writeCellsToMarkdown, RawNotebookCell } from './markdownParser';

const providerOptions = {
	transientMetadata: {
		runnable: true,
		editable: true,
		custom: true,
	},
	transientOutputs: true
};

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.notebook.registerNotebookContentProvider('markdown-notebook', new MarkdownProvider(), providerOptions));
}

class MarkdownProvider implements vscode.NotebookContentProvider {
	options?: vscode.NotebookDocumentContentOptions = providerOptions;

	onDidChangeNotebookContentOptions?: vscode.Event<vscode.NotebookDocumentContentOptions> | undefined;

	async resolveNotebook(document: vscode.NotebookDocument, webview: vscode.NotebookCommunication): Promise<void> { }

	async backupNotebook(document: vscode.NotebookDocument, context: vscode.NotebookDocumentBackupContext, cancellation: vscode.CancellationToken): Promise<vscode.NotebookDocumentBackup> {
		await this.saveNotebookAs(context.destination, document, cancellation);
		return {
			id: context.destination.toString(),
			delete: () => vscode.workspace.fs.delete(context.destination)
		};
	}

	async openNotebook(uri: vscode.Uri, openContext: vscode.NotebookDocumentOpenContext): Promise<vscode.NotebookData> {
		if (openContext.backupId) {
			uri = vscode.Uri.parse(openContext.backupId);
		}

		const metadata = new vscode.NotebookDocumentMetadata().with({
			editable: true,
			cellEditable: true,
			cellHasExecutionOrder: false,
			cellRunnable: false,
			runnable: false
		});
		const content = Buffer.from(await vscode.workspace.fs.readFile(uri))
			.toString('utf8');

		const cellRawData = parseMarkdown(content);
		const cells = cellRawData.map(rawToNotebookCellData);

		return {
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
}

export function rawToNotebookCellData(data: RawNotebookCell): vscode.NotebookCellData {
	return <vscode.NotebookCellData>{
		kind: data.kind,
		language: data.language,
		metadata: new vscode.NotebookCellMetadata().with({ editable: true, runnable: false, custom: { leadingWhitespace: data.leadingWhitespace, trailingWhitespace: data.trailingWhitespace, indentation: data.indentation } }),
		outputs: [],
		source: data.content
	};
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