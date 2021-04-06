/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { parseMarkdown, writeCellsToMarkdown, RawNotebookCell } from './markdownParser';
import * as yaml from 'js-yaml';

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

	// only update metadata 200ms after the last change, to avoid spamming
	vscode.workspace.onDidChangeTextDocument(debounce(updateFrontmatter, 200), null, context.subscriptions);
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

		const content = Buffer.from(await vscode.workspace.fs.readFile(uri))
			.toString('utf8');
		const cellRawData = parseMarkdown(content);

		const metadata = new vscode.NotebookDocumentMetadata().with({
			editable: true,
			cellEditable: true,
			cellHasExecutionOrder: false,
			custom: {
				frontmatter: cellRawData[0]?.isEmbeddedYaml ? cellRawData[0].yaml : null,
			}
		});
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
		metadata: new vscode.NotebookCellMetadata().with({ editable: true, custom: {
			leadingWhitespace: data.leadingWhitespace,
			trailingWhitespace: data.trailingWhitespace,
			indentation: data.indentation,
			isEmbeddedYaml: data.isEmbeddedYaml,
		} }),
		outputs: [],
		source: data.content
	};
}

function debounce<T>(handler: (e: T) => void, interval: number): (e: T) => void {
	let timeoutId: NodeJS.Timeout | undefined;

	return (e: T) => {
		if (typeof timeoutId !== 'undefined') {
			clearTimeout(timeoutId);
		}

		timeoutId = setTimeout(() => handler(e), interval);
	};
}

function updateFrontmatter(event: vscode.TextDocumentChangeEvent) {
	// TODO: can we explicitly check if the notebook is ours?
	const cell = isFrontmatterCell(event.document);
	if (!cell) {
		return;
	}

	const editor = vscode.window.visibleNotebookEditors.find(editor => editor.document === cell.notebook);
	if (!editor) {
		// editor is not visible
		// TODO: can we modify notebook metadata if the editor is not visible, without forcing it to the front?
		return;
	}

	let frontmatter: object | string | number | null | undefined;
	try {
		frontmatter = yaml.load(cell.document.getText());
	} catch (error) {
		// invalid YAML
		return;
	}

	editor.edit(edit => {
		edit.replaceMetadata(cell.notebook.metadata.with({ custom: { frontmatter }}));
	});

	function isFrontmatterCell(document: vscode.TextDocument): vscode.NotebookCell | undefined {
		if (!document.notebook) {
			// document is not a notebook or cell
			return;
		}

		if (!/\.(md|markdown)$/.test(document.uri.path)) {
			// notebook is not ours
			return;
		}

		const cell = document.notebook!.cells.find(cell => cell.document === document);
		if (!cell) {
			// document is not a cell
			return;
		}

		if (cell.index === 0 && cell.metadata.custom?.isEmbeddedYaml) {
			// cell is frontmatter
			return cell;
		}
	}
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